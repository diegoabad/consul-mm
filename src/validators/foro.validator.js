const Joi = require('joi');

const uuidSchema = Joi.string().uuid().required();

const createTemaSchema = Joi.object({
  titulo: Joi.string().max(255).required(),
  descripcion: Joi.string().max(5000).optional().allow(null, ''),
  imagen_url: Joi.string().max(500).optional().allow(null, ''),
  orden: Joi.number().integer().min(0).optional()
}).unknown(true);

const updateTemaSchema = Joi.object({
  titulo: Joi.string().max(255).optional(),
  descripcion: Joi.string().max(5000).optional().allow(null, ''),
  imagen_url: Joi.string().max(500).optional().allow(null, ''),
  activo: Joi.boolean().optional(),
  orden: Joi.number().integer().min(0).optional()
});

const createPostSchema = Joi.object({
  contenido: Joi.string().max(10000).required().trim(),
  parent_id: Joi.string().uuid().optional().allow(null)
});

const updatePostSchema = Joi.object({
  contenido: Joi.string().max(10000).required().trim()
});

const temaParamsSchema = Joi.object({ id: uuidSchema });
const temaRootParamsSchema = Joi.object({ id: uuidSchema, rootId: uuidSchema });
const postParamsSchema = Joi.object({ id: uuidSchema });

const temasQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  includeInactive: Joi.boolean().optional()
});

const postsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  includeModerados: Joi.boolean().optional(),
  order: Joi.string().valid('asc', 'desc').optional(),
  rootsPage: Joi.number().integer().min(1).optional(),
  rootsLimit: Joi.number().integer().min(1).max(50).optional(),
  repliesPerRoot: Joi.number().integer().min(0).max(20).optional()
});

const repliesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  offset: Joi.number().integer().min(0).optional(),
  order: Joi.string().valid('asc', 'desc').optional()
});

const moderarPostSchema = Joi.object({
  moderado: Joi.boolean().required()
});

const updatePermisoForoSchema = Joi.object({
  habilitado: Joi.boolean().required()
});
const permisoUsuarioParamsSchema = Joi.object({ usuarioId: Joi.string().uuid().required() });

module.exports = {
  createTemaSchema,
  updateTemaSchema,
  createPostSchema,
  updatePostSchema,
  temaParamsSchema,
  temaRootParamsSchema,
  postParamsSchema,
  temasQuerySchema,
  postsQuerySchema,
  moderarPostSchema,
  updatePermisoForoSchema,
  permisoUsuarioParamsSchema,
  repliesQuerySchema,
};
