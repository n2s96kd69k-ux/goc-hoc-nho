// ===== Trang /week : chỉ có weekly planner =====
import { plannerHTML, bindPlanner } from '../components/planner.js';

export function renderWeek(root) {
  root.innerHTML = plannerHTML();
  bindPlanner(root);
}
