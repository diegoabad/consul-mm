const express = require('express');
const router = express.Router();
const foroController = require('../controllers/foro.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const { uploadSingleImage, handleMulterError } = require('../middlewares/upload.middleware');
const {
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
} = require('../validators/foro.validator');

// Permisos: profesionales habilitados para el foro (solo admin)
router.get(
  '/permisos',
  authenticate,
  requirePermission('foro.crear_tema'),
  foroController.getProfesionalesHabilitados
);
router.put(
  '/permisos/:usuarioId',
  authenticate,
  requirePermission('foro.crear_tema'),
  validateParams(permisoUsuarioParamsSchema),
  validateBody(updatePermisoForoSchema),
  foroController.updatePermisoForo
);

// Imagen para tema (solo admin)
router.post(
  '/temas/upload-imagen',
  authenticate,
  requirePermission('foro.crear_tema'),
  uploadSingleImage('imagen'),
  handleMulterError,
  foroController.uploadImagenTema
);

// Temas
router.get(
  '/temas',
  authenticate,
  requirePermission('foro.leer'),
  validateQuery(temasQuerySchema),
  foroController.getTemas
);

router.get(
  '/temas/:id',
  authenticate,
  requirePermission('foro.leer'),
  validateParams(temaParamsSchema),
  foroController.getTemaById
);

router.post(
  '/temas',
  authenticate,
  requirePermission('foro.crear_tema'),
  validateBody(createTemaSchema),
  foroController.createTema
);

router.put(
  '/temas/:id',
  authenticate,
  requirePermission('foro.crear_tema'),
  validateParams(temaParamsSchema),
  validateBody(updateTemaSchema),
  foroController.updateTema
);

router.delete(
  '/temas/:id',
  authenticate,
  requirePermission('foro.crear_tema'),
  validateParams(temaParamsSchema),
  foroController.deleteTema
);

// Posts de un tema
router.get(
  '/temas/:id/posts/:rootId/replies',
  authenticate,
  requirePermission('foro.leer'),
  validateParams(temaRootParamsSchema),
  validateQuery(repliesQuerySchema),
  foroController.getRepliesByRoot
);
router.get(
  '/temas/:id/posts',
  authenticate,
  requirePermission('foro.leer'),
  validateParams(temaParamsSchema),
  validateQuery(postsQuerySchema),
  foroController.getPosts
);

router.post(
  '/temas/:id/posts',
  authenticate,
  requirePermission('foro.responder'),
  validateParams(temaParamsSchema),
  validateBody(createPostSchema),
  foroController.createPost
);

// Editar y eliminar post (solo el autor)
router.put(
  '/posts/:id',
  authenticate,
  requirePermission('foro.responder'),
  validateParams(postParamsSchema),
  validateBody(updatePostSchema),
  foroController.updatePost
);

router.delete(
  '/posts/:id',
  authenticate,
  requirePermission('foro.responder'),
  validateParams(postParamsSchema),
  foroController.deletePost
);

// Moderar post
router.put(
  '/posts/:id/moderar',
  authenticate,
  requirePermission('foro.moderar'),
  validateParams(postParamsSchema),
  validateBody(moderarPostSchema),
  foroController.moderarPost
);

module.exports = router;
