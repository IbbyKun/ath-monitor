import apiService from "@/services/api.service";

/**
 * Flat list of every employee in the org + their "primary" manager
 * (see Backend/admin organization.model.js `getOrgChart` — reads the same
 * `assigned_employees` table the existing "Assign Manager" action writes).
 */
export const fetchOrgChart = async () => {
  try {
    const { data } = await apiService.apiInstance.get("/organization/org-chart");
    return Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.error("Org Chart: fetchOrgChart error", error);
    return [];
  }
};

/**
 * Converts the flat {employee_id, manager_employee_id, ...} list into a
 * nested tree amCharts5's Tree series can render. Employees with no manager
 * are roots; if there's more than one root (or none), they're wrapped under
 * a synthetic "Organization" node since Tree expects a single root object.
 * Defensively guards against cycles/orphaned manager ids in case of messy
 * data — an employee is only ever placed once, and any manager id that
 * doesn't resolve to a real node in this org falls back to being a root.
 */
export const buildOrgChartTree = (rows, orgLabel = "Organization") => {
  const nodesById = new Map();
  rows.forEach((r) => {
    nodesById.set(r.employee_id, {
      name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email,
      email: r.email,
      department: r.department,
      role: r.role,
      children: [],
    });
  });

  const roots = [];
  const placed = new Set();
  rows.forEach((r) => {
    const node = nodesById.get(r.employee_id);
    const managerNode = r.manager_employee_id != null ? nodesById.get(r.manager_employee_id) : null;
    if (managerNode && r.manager_employee_id !== r.employee_id && !placed.has(r.employee_id)) {
      managerNode.children.push(node);
      placed.add(r.employee_id);
    } else if (!placed.has(r.employee_id)) {
      roots.push(node);
      placed.add(r.employee_id);
    }
  });

  if (roots.length === 1) return roots[0];
  return { name: orgLabel, children: roots };
};
