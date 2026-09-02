(function () {
  "use strict";

  function industryHref(industry) {
    if (typeof window.mbtViewHref === "function") {
      return window.mbtViewHref({ name: "industry", id: industry.id });
    }
    return "/industry/" + encodeURIComponent(industry.id) + "/";
  }

  function activateIndustry(event, industry, onPick) {
    if (!onPick || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onPick(industry);
  }

  function IndustryBubbleMapLog({ industries, onPick }) {
    const pad = { l: 72, r: 40, t: 40, b: 60 };
    const width = 1280;
    const height = 400;
    const innerWidth = width - pad.l - pad.r;
    const innerHeight = height - pad.t - pad.b;
    const revenues = industries.map((item) => Math.max(1, Number(item.revenue) || 1));
    const margins = industries.map((item) => Number(item.avgMargin) || 0);
    const logMin = Math.log10(Math.min(...revenues)) - 0.1;
    const logMax = Math.log10(Math.max(...revenues)) + 0.1;
    const yMin = Math.min(-5, Math.min(...margins) - 8);
    const yMax = Math.max(20, Math.max(...margins) + 8);
    const sx = (value) => pad.l + ((Math.log10(Math.max(1, value)) - logMin) / (logMax - logMin)) * innerWidth;
    const sy = (value) => pad.t + innerHeight - ((value - yMin) / (yMax - yMin)) * innerHeight;
    const size = (count) => Math.max(20, Math.min(54, Math.sqrt(Number(count) || 0) * 8));
    const xTicks = [1e3, 3e3, 5e3, 1e4, 3e4, 5e4, 1e5, 3e5, 5e5, 1e6, 3e6, 5e6];
    const yTicks = [-5, 0, 5, 10, 15, 20];
    const zeroY = sy(0);
    const points = industries.map((industry) => {
      const cx = sx(Number(industry.revenue) || 1);
      const cy = sy(Number(industry.avgMargin) || 0);
      const radius = size(industry.count);
      const lines = String(industry.name).split(/[·\s]/).filter(Boolean);
      return { industry, cx, cy, radius, lines, labelX: cx, labelY: cy - radius - 12 };
    });

    function labelBox(point) {
      const labelWidth = Math.max(...point.lines.map((line) => line.length)) * 10 + 10;
      const labelHeight = point.lines.length * 21 + 5;
      return {
        x1: point.labelX - labelWidth / 2,
        y1: point.labelY - labelHeight,
        x2: point.labelX + labelWidth / 2,
        y2: point.labelY,
      };
    }

    function labelsOverlap(left, right) {
      const a = labelBox(left);
      const b = labelBox(right);
      return !(a.x2 + 4 < b.x1 || b.x2 + 4 < a.x1 || a.y2 + 4 < b.y1 || b.y2 + 4 < a.y1);
    }

    for (let iteration = 0; iteration < 60; iteration += 1) {
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          if (!labelsOverlap(points[left], points[right])) continue;
          let dx = points[right].labelX - points[left].labelX;
          let dy = points[right].labelY - points[left].labelY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const push = 5;
          points[left].labelX -= (dx / distance) * push * 0.5;
          points[left].labelY -= (dy / distance) * push * 0.5;
          points[right].labelX += (dx / distance) * push * 0.5;
          points[right].labelY += (dy / distance) * push * 0.5;
        }
      }
    }

    points.forEach((point) => {
      const labelWidth = Math.max(...point.lines.map((line) => line.length)) * 10;
      point.labelX = Math.max(pad.l + labelWidth / 2 + 4, Math.min(width - pad.r - labelWidth / 2 - 4, point.labelX));
      point.labelY = Math.max(pad.t + 21 * point.lines.length, point.labelY);
      const nearest = points.reduce((minimum, candidate) => {
        if (candidate === point) return minimum;
        return Math.min(minimum, Math.hypot(candidate.cx - point.cx, candidate.cy - point.cy));
      }, Infinity);
      point.hitRadius = Math.max(6, Math.min(point.radius, 22, (nearest - 6) / 2));
    });

    const elements = React.createElement;
    return elements(
      "svg",
      { viewBox: "0 0 1280 400", width: "100%", className: "mbt-accessible-bubble-map", role: "img", "aria-label": "산업 매출 규모와 평균 영업이익률 버블맵" },
      elements("line", { x1: pad.l, x2: width - pad.r, y1: zeroY, y2: zeroY, stroke: "#B5321A", strokeDasharray: "3 3", strokeWidth: "1", opacity: "0.4" }),
      yTicks.map((tick) => elements("line", { key: "yl-" + tick, x1: pad.l, x2: width - pad.r, y1: sy(tick), y2: sy(tick), stroke: "#E5E2DA", strokeDasharray: "2 4", strokeWidth: "0.8" })),
      yTicks.map((tick) => elements("text", { key: "yt-" + tick, x: pad.l - 8, y: sy(tick) + 4, textAnchor: "end", fontSize: "14", fill: "#76746F", fontFamily: "Pretendard Variable, sans-serif" }, tick, "%")),
      xTicks.map((tick) => {
        const x = sx(tick);
        if (x < pad.l - 1 || x > width - pad.r + 1) return null;
        const label = tick >= 1e7 ? tick / 1e7 + "천조" : tick >= 1e6 ? tick / 1e6 + "백조" : tick >= 1e4 ? (tick / 1e4).toFixed(1) + "조" : tick / 1e3 + "천억";
        return elements("g", { key: "x-" + tick },
          elements("line", { x1: x, x2: x, y1: pad.t, y2: pad.t + innerHeight, stroke: "#E5E2DA", strokeDasharray: "2 4", strokeWidth: "0.8" }),
          elements("text", { x, y: pad.t + innerHeight + 20, textAnchor: "middle", fontSize: "13", fill: "#76746F", fontFamily: "Pretendard Variable, sans-serif" }, label));
      }),
      elements("text", { x: pad.l + innerWidth / 2, y: 396, textAnchor: "middle", fontSize: "14", fill: "#575754", fontFamily: "Pretendard Variable, sans-serif" }, "2024 총매출 (로그 스케일)"),
      elements("text", { transform: `rotate(-90) translate(${-(pad.t + innerHeight / 2)}, ${pad.l - 46})`, textAnchor: "middle", fontSize: "14", fill: "#575754", fontFamily: "Pretendard Variable, sans-serif" }, "↑ 평균 영업이익률 (%)"),
      elements("line", { x1: pad.l, x2: width - pad.r, y1: pad.t + innerHeight, y2: pad.t + innerHeight, stroke: "#111", strokeWidth: "1.5" }),
      elements("line", { x1: pad.l, x2: pad.l, y1: pad.t, y2: pad.t + innerHeight, stroke: "#111", strokeWidth: "1.5" }),
      points.map((point) => elements("g", { key: "visual-" + point.industry.id, style: { pointerEvents: "none" } },
        elements("circle", { cx: point.cx, cy: point.cy, r: point.radius, fill: point.industry.color, opacity: "0.18" }),
        elements("circle", { cx: point.cx, cy: point.cy, r: point.radius, fill: "none", stroke: point.industry.color, strokeWidth: "1.5", opacity: "0.6" }),
        elements("circle", { cx: point.cx, cy: point.cy, r: "4", fill: point.industry.color }),
        Math.hypot(point.labelX - point.cx, point.labelY - (point.cy - point.radius)) > 14
          ? elements("line", { x1: point.cx, y1: point.cy - point.radius - 2, x2: point.labelX, y2: point.labelY + 2, stroke: point.industry.color, strokeWidth: "0.8", opacity: "0.45", strokeDasharray: "3 2" })
          : null)),
      points.map((point) => elements(
        "a",
        {
          key: "link-" + point.industry.id,
          href: industryHref(point.industry),
          className: "mbt-bubble-link",
          tabIndex: 0,
          "aria-label": point.industry.name + " 산업 상세 보기",
          onClick: (event) => activateIndustry(event, point.industry, onPick),
          onKeyDown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (onPick) onPick(point.industry);
            else window.location.assign(industryHref(point.industry));
          },
        },
        elements("title", null, point.industry.name + " 산업 상세 보기"),
        elements("circle", { className: "mbt-bubble-focus-ring", cx: point.cx, cy: point.cy, r: point.hitRadius + 4, fill: "none", stroke: point.industry.color, strokeWidth: "2" }),
        elements("circle", { className: "mbt-bubble-hit-area", cx: point.cx, cy: point.cy, r: point.hitRadius, fill: "transparent" }),
        point.lines.map((line, index) => elements("text", {
          key: index,
          x: point.labelX,
          y: point.labelY - (point.lines.length - 1 - index) * 21,
          textAnchor: "middle",
          fontSize: "17",
          fontWeight: "700",
          fill: point.industry.color,
          fontFamily: "Pretendard Variable, sans-serif",
          paintOrder: "stroke",
          stroke: "white",
          strokeWidth: "3",
          strokeLinejoin: "round",
        }, line)))));
  }

  window.IndustryBubbleMapLog = IndustryBubbleMapLog;
})();
