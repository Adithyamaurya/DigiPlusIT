import { Router } from 'express';
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  matchDocuments,
  linkDocumentToDecision,
  askQuestionAboutMemory
} from '../controllers/knowledgeController.js';

const router = Router();

router.get('/', getAllDocuments);
router.post('/', createDocument);
router.post('/ask', askQuestionAboutMemory);
router.get('/match', matchDocuments);
router.post('/link-decision', linkDocumentToDecision);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.delete('/:id', deleteDocument);

export default router;
