import { Router } from 'express';
import { getProjectCatchup, getHandoffCatchup, getOnboardingBrief } from '../controllers/catchupController.js';
import { previewMeetingRecap } from '../controllers/meetingController.js';

const router = Router();

router.post('/project-catchup', getProjectCatchup);
router.post('/handoff-catchup', getHandoffCatchup);
router.post('/onboarding-brief', getOnboardingBrief);
router.post('/meeting-recap', previewMeetingRecap);

export default router;
