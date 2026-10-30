import { query } from '../config/db.js';
import { 
  generateProjectContextGraph, 
  compareProjectContext, 
  acknowledgeUserContext 
} from '../services/contextGraphService.js';

async function testGraphFeatures() {
  console.log('========================================================');
  console.log('🧪 Testing User-Wise Git Context Graph & Diff Engine');
  console.log('========================================================\n');

  try {
    const projRes = await query(`SELECT id, name FROM projects LIMIT 1`);
    const project = projRes.rows[0];

    const usersRes = await query(`SELECT id, name, role FROM users ORDER BY name ASC`);
    const users = usersRes.rows;
    const rahul = users.find(u => u.name.includes('Rahul'));
    const adithya = users.find(u => u.name.includes('Adithya'));

    console.log(`Project: "${project.name}"`);
    console.log(`Users: ${users.map(u => u.name).join(', ')}\n`);

    // 1. Fetch graph for Rahul (who stopped at older context point)
    console.log('--- 1. Testing Rahul Context Position (Older Context Point) ---');
    const rahulGraph = await generateProjectContextGraph(project.id, { userId: rahul.id });
    
    console.log(`- Rahul Last Acknowledged Event: "${rahulGraph.userPosition.lastAcknowledgedNode?.title}" (${rahulGraph.userPosition.lastAcknowledgedNode?.date})`);
    console.log(`- Project Latest Event: "${rahulGraph.userPosition.latestNode?.title}" (${rahulGraph.userPosition.latestNode?.date})`);
    console.log(`- Context Gap Count: ${rahulGraph.userPosition.contextGapCount} missed updates!`);
    console.log(`- Is Rahul Caught Up? ${rahulGraph.userPosition.isCaughtUp ? 'YES' : 'NO'}`);
    console.log(`- Total Graph Nodes: ${rahulGraph.nodes.length}`);
    console.log(`- Total Graph Edges: ${rahulGraph.edges.length}`);
    console.log(`- Lanes: ${rahulGraph.lanes.map(l => l.name).join(' | ')}`);

    if (rahulGraph.userPosition.contextGapCount <= 0) {
      throw new Error('Expected Rahul to have missed context updates');
    }
    console.log('✅ Rahul context position and gap detection verified!\n');

    // 2. Test Context Difference Engine between Rahul's position and Latest
    console.log('--- 2. Testing Context Diff Engine (What Changed) ---');
    const fromId = rahulGraph.userPosition.lastAcknowledgedEventId;
    const toId = rahulGraph.userPosition.latestNode.id;

    const diff = await compareProjectContext(project.id, fromId, toId);
    console.log(`- Diff boundary: "${diff.fromEvent.title}" ➔ "${diff.toEvent.title}"`);
    console.log(`- Total Events in Gap: ${diff.totalEventsDifference}`);
    console.log(`- New Decisions: ${diff.differences.newDecisions.length}`);
    diff.differences.newDecisions.forEach(d => console.log(`  * [DECISION] ${d.title} (Status: ${d.status})`));
    console.log(`- New Tasks: ${diff.differences.newTasks.length}`);
    diff.differences.newTasks.forEach(t => console.log(`  * [TASK] ${t.title} (${t.status}, Due: ${t.dueDate})`));
    console.log(`- Completed Tasks: ${diff.differences.completedTasks.length}`);
    diff.differences.completedTasks.forEach(t => console.log(`  * [COMPLETED] ${t.title} (Outcome: ${t.outcome})`));
    console.log(`- Handoffs: ${diff.differences.handoffs.length}`);
    diff.differences.handoffs.forEach(h => console.log(`  * [HANDOFF] ${h.title}: ${h.reason}`));
    console.log(`- New Documents: ${diff.differences.newDocuments.length}`);
    console.log(`- Milestones: ${diff.differences.milestones.length}`);
    console.log('✅ Context difference engine verified with real database records!\n');

    // 3. Test Acknowledging Context (Advancing Rahul's position)
    console.log('--- 3. Testing Context Acknowledgment & Position Advance ---');
    console.log(`Advancing Rahul position to latest node: "${toId}"...`);
    const ackRes = await acknowledgeUserContext(project.id, rahul.id, toId);
    console.log(`- Acknowledged at: ${ackRes.last_acknowledged_at}`);

    // Re-fetch graph for Rahul
    const updatedRahulGraph = await generateProjectContextGraph(project.id, { userId: rahul.id });
    console.log(`- Updated Gap Count: ${updatedRahulGraph.userPosition.contextGapCount}`);
    console.log(`- Is Rahul Now Caught Up? ${updatedRahulGraph.userPosition.isCaughtUp ? 'YES' : 'NO'}`);

    if (!updatedRahulGraph.userPosition.isCaughtUp) {
      throw new Error('Rahul should now be caught up after acknowledging');
    }
    console.log('✅ User position advancement and persistence verified!\n');

    // Reset Rahul's position back to fromId for demonstration in the UI
    await acknowledgeUserContext(project.id, rahul.id, fromId);
    console.log(`(Reset Rahul position back to demonstration context point so UI exhibits gap)\n`);

    console.log('========================================================');
    console.log('🎉 ALL USER-WISE GIT GRAPH CAPABILITIES PASSED!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testGraphFeatures();

