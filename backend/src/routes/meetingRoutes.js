import { Router } from 'express';
import {
  getAllMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getPendingItemsForCarryForward,
  previewMeetingRecap,
  saveMeetingRecap
} from '../controllers/meetingController.js';

const router = Router();

router.get('/', getAllMeetings);
router.post('/', createMeeting);
router.get('/pending-carry-forward', getPendingItemsForCarryForward);
router.get('/:id', getMeetingById);
router.put('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);
router.get('/:id/pending-items', getPendingItemsForCarryForward);
router.post('/preview-recap', previewMeetingRecap);
router.post('/:id/recap/save', saveMeetingRecap);

export default router;

