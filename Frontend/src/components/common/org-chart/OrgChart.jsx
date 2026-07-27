import { useEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5hierarchy from "@amcharts/amcharts5/hierarchy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

/**
 * Org chart rendered with amCharts5's Hierarchy/Tree module — already
 * shipped by the @amcharts/amcharts5 package this app depends on for its
 * other charts (donut/bar/geo), just not previously used for hierarchies.
 *
 * treeData: a single nested node { name, email, department, role, children: [...] }
 * — see page/protected/admin/org-chart/service.js `buildOrgChartTree`.
 */
export default function OrgChart({ treeData }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!treeData) return;
    const root = am5.Root.new(chartRef.current);
    if (root._logo) root._logo.dispose();
    root.setThemes([am5themes_Animated.new(root)]);

    const container = root.container.children.push(
      am5.Container.new(root, { width: am5.percent(100), height: am5.percent(100) })
    );

    const series = container.children.push(
      am5hierarchy.Tree.new(root, {
        singleBranchOnly: false,
        downDepth: 5,
        initialDepth: 5,
        topDepth: 0,
        valueField: "value",
        categoryField: "name",
        childDataField: "children",
        orientation: "vertical",
      })
    );

    series.nodes.template.setAll({ tooltipText: "{category}\n{department}\n{role}" });
    series.labels.template.setAll({ fontSize: 12, fontWeight: "600" });
    series.circles.template.setAll({ fill: am5.color(0x2079fd), fillOpacity: 0.85 });

    series.data.setAll([treeData]);
    series.set("selectedDataItem", series.dataItems[0]);
    series.appear(800, 100);

    return () => root.dispose();
  }, [treeData]);

  return <div ref={chartRef} className="w-full h-[70vh]" />;
}
