const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Listar posts de un tema con paginación
 */
const findByTemaPaginated = async (temaId, filters = {}) => {
  try {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const includeModerados = filters.includeModerados === true; // solo admin

    const whereMod = includeModerados ? '' : ' AND p.moderado = false';
    const orderDir = filters.order === 'desc' ? 'DESC' : 'ASC';
    const countResult = await query(
      'SELECT COUNT(*)::int AS total FROM foro_post p WHERE p.tema_id = $1' + whereMod,
      [temaId]
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataResult = await query(
      `SELECT p.*, u.nombre as autor_nombre, u.apellido as autor_apellido, u.rol as autor_rol,
              pr.especialidad as autor_especialidad,
              pp.usuario_id as parent_usuario_id, up.nombre as parent_autor_nombre, up.apellido as parent_autor_apellido,
              up.rol as parent_autor_rol, ppr.especialidad as parent_autor_especialidad
       FROM foro_post p
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN profesionales pr ON pr.usuario_id = p.usuario_id
       LEFT JOIN foro_post pp ON p.parent_id = pp.id
       LEFT JOIN foro_post root ON root.id = COALESCE(p.parent_id, p.id) AND root.tema_id = p.tema_id
       LEFT JOIN usuarios up ON pp.usuario_id = up.id
       LEFT JOIN profesionales ppr ON ppr.usuario_id = pp.usuario_id
       WHERE p.tema_id = $1 ${whereMod}
       ORDER BY root.fecha_creacion ${orderDir}, COALESCE(p.parent_id, p.id) ASC, CASE WHEN p.parent_id IS NULL THEN 0 ELSE 1 END, p.fecha_creacion ${orderDir}
       LIMIT $2 OFFSET $3`,
      [temaId, limit, offset]
    );
    return { rows: dataResult.rows, total };
  } catch (error) {
    logger.error('Error en findByTemaPaginated foro_post:', error);
    throw error;
  }
};

/**
 * Crear post
 */
const create = async (data) => {
  try {
    const { tema_id, usuario_id, contenido, parent_id } = data;
    const result = await query(
      `INSERT INTO foro_post (tema_id, usuario_id, contenido, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tema_id, usuario_id, contenido, parent_id || null]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create foro_post:', error);
    throw error;
  }
};

/**
 * Buscar post por id (para verificar autoría)
 */
const findById = async (id) => {
  try {
    const result = await query(
      'SELECT id, usuario_id, tema_id, contenido FROM foro_post WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById foro_post:', error);
    throw error;
  }
};

/**
 * Actualizar contenido de un post
 */
const update = async (id, contenido) => {
  try {
    const result = await query(
      'UPDATE foro_post SET contenido = $1 WHERE id = $2 RETURNING *',
      [contenido, id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update foro_post:', error);
    throw error;
  }
};

/**
 * Buscar post por id y tema (para validar parent_id)
 */
const findByIdAndTema = async (id, temaId) => {
  try {
    const result = await query(
      'SELECT id FROM foro_post WHERE id = $1 AND tema_id = $2',
      [id, temaId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByIdAndTema foro_post:', error);
    throw error;
  }
};

/**
 * Listar posts por raíces: N raíces por página, cada una con hasta M respuestas
 * @returns { roots: [{ post, replies: [...], totalReplies }], totalRoots, rootsPage, rootsTotalPages }
 */
const findByTemaPaginatedByRoots = async (temaId, filters = {}) => {
  try {
    const rootsPage = Math.max(1, parseInt(filters.rootsPage, 10) || 1);
    const rootsLimit = Math.min(50, Math.max(1, parseInt(filters.rootsLimit, 10) || 10));
    const repliesPerRoot = Math.min(20, Math.max(0, parseInt(filters.repliesPerRoot, 10) || 2));
    const includeModerados = filters.includeModerados === true;
    const orderDir = filters.order === 'desc' ? 'DESC' : 'ASC';
    const whereMod = includeModerados ? '' : ' AND p.moderado = false';

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM foro_post p WHERE p.tema_id = $1 AND p.parent_id IS NULL ${whereMod}`,
      [temaId]
    );
    const totalRoots = countResult.rows[0]?.total ?? 0;
    const rootsTotalPages = Math.ceil(totalRoots / rootsLimit) || 0;
    const rootsOffset = (rootsPage - 1) * rootsLimit;

    const rootsResult = await query(
      `SELECT p.*, u.nombre as autor_nombre, u.apellido as autor_apellido, u.rol as autor_rol,
              pr.especialidad as autor_especialidad,
              NULL::uuid as parent_usuario_id, NULL as parent_autor_nombre, NULL as parent_autor_apellido,
              NULL as parent_autor_rol, NULL as parent_autor_especialidad
       FROM foro_post p
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN profesionales pr ON pr.usuario_id = p.usuario_id
       WHERE p.tema_id = $1 AND p.parent_id IS NULL ${whereMod}
       ORDER BY p.fecha_creacion ${orderDir}
       LIMIT $2 OFFSET $3`,
      [temaId, rootsLimit, rootsOffset]
    );
    const roots = rootsResult.rows;

    const rootIds = roots.map((r) => r.id);
    let totalsMap = new Map();
    let repliesMap = new Map();

    if (rootIds.length > 0) {
      if (repliesPerRoot > 0) {
        // Contar todos los descendientes por root (incluye anidados)
        for (const rootId of rootIds) {
          const countRes = await query(
            `WITH RECURSIVE thread AS (
               SELECT id FROM foro_post WHERE id = $2 AND tema_id = $1
               UNION
               SELECT p.id FROM foro_post p
               INNER JOIN thread t ON p.parent_id = t.id
               WHERE p.tema_id = $1
             )
             SELECT COUNT(*)::int AS total FROM foro_post p
             WHERE p.tema_id = $1 AND p.parent_id IN (SELECT id FROM thread) ${whereMod}`,
            [temaId, rootId]
          );
          totalsMap.set(rootId, countRes.rows[0]?.total ?? 0);
        }

        // Obtener los primeros N descendientes por root (ordenados por fecha)
        const repliesResult = await query(
          `WITH RECURSIVE thread AS (
             SELECT r.id, r.id as root_id FROM foro_post r WHERE r.id = ANY($2::uuid[]) AND r.tema_id = $1
             UNION
             SELECT p.id, t.root_id FROM foro_post p
             INNER JOIN thread t ON p.parent_id = t.id
             WHERE p.tema_id = $1
           ),
           all_replies AS (
             SELECT p.*, u.nombre as autor_nombre, u.apellido as autor_apellido, u.rol as autor_rol,
                    pr.especialidad as autor_especialidad,
                    pp.usuario_id as parent_usuario_id, up.nombre as parent_autor_nombre, up.apellido as parent_autor_apellido,
                    up.rol as parent_autor_rol, ppr.especialidad as parent_autor_especialidad,
                    t.root_id,
                    ROW_NUMBER() OVER (PARTITION BY t.root_id ORDER BY p.fecha_creacion ${orderDir}) as rn
             FROM foro_post p
             JOIN usuarios u ON p.usuario_id = u.id
             LEFT JOIN profesionales pr ON pr.usuario_id = p.usuario_id
             LEFT JOIN foro_post pp ON p.parent_id = pp.id
             LEFT JOIN usuarios up ON pp.usuario_id = up.id
             LEFT JOIN profesionales ppr ON ppr.usuario_id = pp.usuario_id
             INNER JOIN thread t ON p.parent_id = t.id
             WHERE p.tema_id = $1 ${whereMod}
           )
           SELECT id, tema_id, usuario_id, parent_id, contenido, moderado, fecha_creacion,
                  autor_nombre, autor_apellido, autor_rol, autor_especialidad,
                  parent_usuario_id, parent_autor_nombre, parent_autor_apellido, parent_autor_rol, parent_autor_especialidad,
                  root_id
           FROM all_replies WHERE rn <= $3
           ORDER BY root_id, rn`,
          [temaId, rootIds, repliesPerRoot]
        );
        const byParent = new Map();
        repliesResult.rows.forEach((row) => {
          const pid = row.root_id;
          const { root_id, ...post } = row;
          if (!byParent.has(pid)) byParent.set(pid, []);
          byParent.get(pid).push(post);
        });
        repliesMap = byParent;
      }
    }

    const rootsWithReplies = roots.map((root) => {
      const replies = (repliesMap.get(root.id) || []).sort((a, b) =>
        orderDir === 'ASC'
          ? new Date(a.fecha_creacion) - new Date(b.fecha_creacion)
          : new Date(b.fecha_creacion) - new Date(a.fecha_creacion)
      );
      const totalReplies = totalsMap.get(root.id) ?? 0;
      return { post: root, replies, totalReplies };
    });

    return { roots: rootsWithReplies, totalRoots, rootsPage, rootsTotalPages, repliesPerRoot };
  } catch (error) {
    logger.error('Error en findByTemaPaginatedByRoots:', error);
    throw error;
  }
};

/**
 * Listar respuestas de un post raíz (para ampliar)
 * Incluye respuestas anidadas (respuestas a respuestas)
 */
const findRepliesByRootPaginated = async (temaId, rootId, filters = {}) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 10));
    const offset = filters.offset !== undefined
      ? Math.max(0, parseInt(filters.offset, 10))
      : (Math.max(1, parseInt(filters.page, 10) || 1) - 1) * limit;
    const includeModerados = filters.includeModerados === true;
    const orderDir = filters.order === 'desc' ? 'DESC' : 'ASC';
    const whereMod = includeModerados ? '' : ' AND p.moderado = false';

    // CTE recursivo: root + todos los descendientes (para incluir respuestas anidadas)
    const countResult = await query(
      `WITH RECURSIVE thread AS (
         SELECT id FROM foro_post WHERE id = $2 AND tema_id = $1
         UNION
         SELECT p.id FROM foro_post p
         INNER JOIN thread t ON p.parent_id = t.id
         WHERE p.tema_id = $1
       )
       SELECT COUNT(*)::int AS total FROM foro_post p
       WHERE p.tema_id = $1 AND p.parent_id IN (SELECT id FROM thread) ${whereMod}`,
      [temaId, rootId]
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataResult = await query(
      `WITH RECURSIVE thread AS (
         SELECT id FROM foro_post WHERE id = $2 AND tema_id = $1
         UNION
         SELECT p.id FROM foro_post p
         INNER JOIN thread t ON p.parent_id = t.id
         WHERE p.tema_id = $1
       ),
       ordered AS (
         SELECT p.id, p.fecha_creacion,
                ROW_NUMBER() OVER (ORDER BY p.fecha_creacion ${orderDir}) - 1 AS rn
         FROM foro_post p
         WHERE p.tema_id = $1 AND p.parent_id IN (SELECT id FROM thread) ${whereMod}
       )
       SELECT p.*, u.nombre as autor_nombre, u.apellido as autor_apellido, u.rol as autor_rol,
              pr.especialidad as autor_especialidad,
              pp.usuario_id as parent_usuario_id, up.nombre as parent_autor_nombre, up.apellido as parent_autor_apellido,
              up.rol as parent_autor_rol, ppr.especialidad as parent_autor_especialidad
       FROM foro_post p
       JOIN usuarios u ON p.usuario_id = u.id
       LEFT JOIN profesionales pr ON pr.usuario_id = p.usuario_id
       LEFT JOIN foro_post pp ON p.parent_id = pp.id
       LEFT JOIN usuarios up ON pp.usuario_id = up.id
       LEFT JOIN profesionales ppr ON ppr.usuario_id = pp.usuario_id
       INNER JOIN ordered o ON p.id = o.id
       WHERE o.rn >= $3 AND o.rn < $3 + $4
       ORDER BY p.fecha_creacion ${orderDir}`,
      [temaId, rootId, offset, limit]
    );
    const totalPages = Math.ceil(total / limit) || 0;
    return { rows: dataResult.rows, total, page: Math.floor(offset / limit) + 1, limit, totalPages };
  } catch (error) {
    logger.error('Error en findRepliesByRootPaginated:', error);
    throw error;
  }
};

/**
 * Marcar/desmarcar como moderado
 */
const setModerado = async (id, moderado) => {
  try {
    const result = await query(
      'UPDATE foro_post SET moderado = $1 WHERE id = $2 RETURNING *',
      [!!moderado, id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en setModerado foro_post:', error);
    throw error;
  }
};

/**
 * Eliminar post
 */
const deleteById = async (id) => {
  try {
    await query('DELETE FROM foro_post WHERE id = $1', [id]);
    return true;
  } catch (error) {
    logger.error('Error en delete foro_post:', error);
    throw error;
  }
};

module.exports = {
  findByTemaPaginated,
  findByTemaPaginatedByRoots,
  findRepliesByRootPaginated,
  create,
  findById,
  update,
  findByIdAndTema,
  setModerado,
  deleteById,
};
