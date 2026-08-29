(function () {
  const PRODUCTION_API = "https://mbt-public-api.ryw1220.workers.dev";
  const host = window.location.hostname;
  const MBT_API_BASE = host.endsWith(".workers.dev") ? "" : PRODUCTION_API;
  const MBT_CLIENT_RELEASE = "MBT-WEB-2026-RC3";
  const MBT_INDUSTRY_MAP_VERSION = "MBT-12-INDUSTRY-MAP-2026-V1";

  const MBT_RAW_INDUSTRY_MAP = {
    "식품": "food", "베이커리": "food", "기타음료": "food", "외식": "food",
    "외식&패스트푸드": "food", "제과": "food", "카페": "food",
    "패션/의류": "fashion", "패션 플랫폼": "fashion", "패션플랫폼": "fashion",
    "화장품": "beauty", "뷰티": "beauty", "패션/화장품": "beauty",
    "바이오/화장품": "beauty", "제약": "beauty", "인프라&서비스": "beauty",
    "가전": "living", "리빙": "living", "제조": "living", "기계": "living",
    "전자기기": "living", "전자제품/카메라": "living", "서비스/세탁": "living",
    "서비스/클리닝": "living", "세탁 서비스": "living", "헬스케어": "living",
    "헬스케어/의료기기": "living", "건설": "living", "건설/부동산": "living",
    "건설/제조": "living", "화학": "living", "제지": "living", "디자인": "living",
    "공유오피스": "living", "부동산": "living",
    "엔터테인먼트": "content", "게임": "content", "콘텐츠": "content", "예술품": "content",
    "광고": "media", "리서치": "media", "사진": "media",
    "출판사": "pub", "에듀테크": "edu",
    "플랫폼": "commerce", "커머스": "commerce", "중개": "commerce",
    "네트워크 마케팅": "commerce", "패션 아울렛": "commerce",
    "호텔/리조트": "leisure", "항공": "leisure", "레저": "leisure", "여행": "leisure",
    "금융": "tech", "반도체": "tech", "컨설팅": "tech",
    "자동차": "mobility", "운송": "mobility", "중고 커머스": "mobility",
  };

  const MBT_COMPANY_INDUSTRY_OVERRIDES = {
    "헤이딜러": "mobility", "케이카": "mobility", "볼보그룹코리아": "mobility",
    "센드버드코리아": "tech", "미미박스": "beauty", "화해(버드뷰)": "beauty",
    "한국후지필름": "living", "캐논": "living", "서울옥션": "content",
    "아라리오": "content", "코오롱 인더스트리": "fashion", "글로우서울": "living",
  };

  function mbtApi(path) {
    const separator = path.includes("?") ? "&" : "?";
    return MBT_API_BASE + path + separator + "clientRelease=" + encodeURIComponent(MBT_CLIENT_RELEASE);
  }

  async function mbtFetch(path, signal) {
    const response = await fetch(mbtApi(path), {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "데이터를 불러오지 못했습니다.");
    }
    return response.json();
  }

  function mbtFormatEok(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const number = Number(value);
    const absolute = Math.abs(number);
    const fractionDigits = absolute >= 1000 ? 0 : absolute >= 100 ? 1 : 1;
    return number.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    }) + "억원";
  }

  function mbtFormatPercent(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "%";
  }

  function mbtListedLabel(value) {
    if (value === true) return "상장";
    if (value === false) return "비상장";
    return "구분 미상";
  }

  function mbtNormalizeCompanyName(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/주식회사|유한회사|㈜|\(주\)/g, "")
      .replace(/[\s·.,()_-]/g, "");
  }

  function mbtLegacyIndustryId(company) {
    const override = MBT_COMPANY_INDUSTRY_OVERRIDES[company?.name];
    if (override) return override;
    if (typeof company?.industry === "object" && company.industry?.id) return company.industry.id;
    if (typeof company?.industry === "string" && company.industry) return company.industry;
    return MBT_RAW_INDUSTRY_MAP[company?.industry?.detail] || "commerce";
  }

  function mbtIndustryMeta(company) {
    const id = mbtLegacyIndustryId(company);
    const legacy = (window.TASTE_INDUSTRIES || []).find((item) => item.id === id);
    return {
      id,
      name: legacy?.name || company?.industry?.name || "기타",
      detail: company?.industry?.detail || "산업 분류 확인 중",
      color: legacy?.color || "#B5321A",
    };
  }

  function mbtLatestValue(company, key) {
    const value = company?.latestFinancials?.[key];
    return value === null || value === undefined ? null : Number(value);
  }

  function mbtRosterCompany(company) {
    const industry = mbtIndustryMeta(company);
    const metrics = Array.isArray(company?.financials) ? company.financials : [];
    const revenueSeries = {};
    const profitSeries = {};
    const marginSeries = {};
    const growthLabels = {};
    for (const row of metrics) {
      const year = String(row.year);
      if (row.revenueEok !== null && row.revenueEok !== undefined) revenueSeries[year] = Number(row.revenueEok);
      if (row.operatingProfitEok !== null && row.operatingProfitEok !== undefined) profitSeries[year] = Number(row.operatingProfitEok);
      if (row.operatingMarginPct !== null && row.operatingMarginPct !== undefined) marginSeries[year] = Number(row.operatingMarginPct);
    }
    const revenueYears = Object.keys(revenueSeries).sort();
    for (let index = 1; index < revenueYears.length; index += 1) {
      const year = revenueYears[index];
      const previous = revenueSeries[revenueYears[index - 1]];
      if (previous) growthLabels[year] = ((revenueSeries[year] - previous) / Math.abs(previous)) * 100;
    }
    const latestYear = company?.latestFinancials?.year ? String(company.latestFinancials.year) : null;
    const latestRevenue = mbtLatestValue(company, "revenueEok");
    const latestProfit = mbtLatestValue(company, "operatingProfitEok");
    const latestMargin = mbtLatestValue(company, "operatingMarginPct");
    if (latestYear && latestRevenue !== null && revenueSeries[latestYear] === undefined) revenueSeries[latestYear] = latestRevenue;
    if (latestYear && latestProfit !== null && profitSeries[latestYear] === undefined) profitSeries[latestYear] = latestProfit;
    if (latestYear && latestMargin !== null && marginSeries[latestYear] === undefined) marginSeries[latestYear] = latestMargin;
    const employees = company?.workforce?.employees ?? null;
    return {
      name: company.name,
      legalName: company.legalName || company.name,
      industry: industry.id,
      industryName: industry.name,
      revenue: revenueSeries,
      profit: profitSeries,
      margins: marginSeries,
      growthLabels,
      founded: company.foundedYear ?? null,
      employees,
      location: company.headquarters || null,
      revenuePerEmployee: latestRevenue !== null && employees ? latestRevenue / employees : null,
      profitPerEmployee: latestProfit !== null && employees ? latestProfit / employees : null,
      avgSalary: null,
      listed: company.listed,
      parent: null,
      description: company.description || `${industry.detail} 분야의 ${company.name} 기업 정보입니다.`,
      insight: "공개 DB의 확인된 수치를 기준으로 재무와 인력 현황을 살펴봅니다.",
      insightPos: [],
      insightNeg: [],
      brands: [],
      competitors: [],
      rank: { revenue: null, margin: null },
      bookRef: `${company.name}의 재무제표에서 발견한 것들`,
      __apiPublicId: company.publicId,
      __industryRaw: industry.detail,
      __industryMapVersion: MBT_INDUSTRY_MAP_VERSION,
    };
  }

  function mbtCompanyDestination(company) {
    return {
      name: "company",
      id: company?.name || company?.legalName || company?.publicId || company?.__apiPublicId,
    };
  }

  async function mbtLoadPublicRoster() {
    if (window.__MBT_PUBLIC_ROSTER_PROMISE) return window.__MBT_PUBLIC_ROSTER_PROMISE;
    window.__MBT_PUBLIC_ROSTER_PROMISE = (async () => {
      const first = await mbtFetch("/api/v1/companies?page=1&pageSize=50&include=metrics");
      const remaining = await Promise.all(
        Array.from({ length: Math.max(0, (first.pageCount || 1) - 1) }, (_, index) => (
          mbtFetch("/api/v1/companies?page=" + (index + 2) + "&pageSize=50&include=metrics")
        )),
      );
      const roster = [first, ...remaining].flatMap((page) => page.items || []);
      const legacyCompanies = window.TASTE_COMPANIES || {};
      const normalizedLegacy = new Set();
      let added = 0;
      for (const company of roster) {
        const merged = mbtRosterCompany(company);
        legacyCompanies[merged.name] = merged;
        normalizedLegacy.add(mbtNormalizeCompanyName(merged.name));
        normalizedLegacy.add(mbtNormalizeCompanyName(merged.legalName));
        window.TASTE_SUBCAT = window.TASTE_SUBCAT || {};
        if (!window.TASTE_SUBCAT[merged.name]) window.TASTE_SUBCAT[merged.name] = merged.__industryRaw || "기타";
        window.TASTE_STOCK = window.TASTE_STOCK || {};
        if (company.stock?.summary) {
          window.TASTE_STOCK[merged.name] = [
            { m: company.stock.summary.firstMonth, p: company.stock.summary.firstCloseKrw },
            { m: company.stock.summary.lastMonth, p: company.stock.summary.lastCloseKrw },
          ];
        }
        added += 1;
      }
      for (const industry of window.TASTE_INDUSTRIES || []) {
        const companies = Object.values(legacyCompanies).filter((company) => company.industry === industry.id);
        industry.count = companies.length;
        industry.revenue = companies.reduce((sum, company) => (
          sum + Number(company.revenue?.["2025"] ?? company.revenue?.["2024"] ?? 0)
        ), 0);
      }
      const stats = {
        releaseId: first.releaseId,
        scopeId: first.scopeId,
        roster: roster.length,
        added,
        integrated: Object.keys(legacyCompanies).length,
        industryMapVersion: MBT_INDUSTRY_MAP_VERSION,
      };
      window.__MBT_PUBLIC_ROSTER_STATS = stats;
      window.dispatchEvent(new CustomEvent("mbt:public-roster-ready", { detail: stats }));
      return stats;
    })().catch((error) => {
      window.__MBT_PUBLIC_ROSTER_ERROR = error;
      throw error;
    });
    return window.__MBT_PUBLIC_ROSTER_PROMISE;
  }

  function PublicRosterBootstrap({ onReady }) {
    React.useEffect(() => {
      let active = true;
      mbtLoadPublicRoster()
        .then((stats) => { if (active && onReady) onReady(stats); })
        .catch(() => { if (active && onReady) onReady(null); });
      return () => { active = false; };
    }, []);
    return null;
  }

  async function mbtResolveRosterCompany(companyName) {
    await mbtLoadPublicRoster();
    const normalized = mbtNormalizeCompanyName(companyName);
    return Object.values(window.TASTE_COMPANIES || {}).find((company) => (
      mbtNormalizeCompanyName(company?.name) === normalized ||
      mbtNormalizeCompanyName(company?.legalName) === normalized ||
      company?.__apiPublicId === companyName
    )) || null;
  }

  function CompanyProfileResolver({ companyId, onView }) {
    const [state, setState] = React.useState({ status: "loading", legacyKey: null, publicId: null, error: "" });

    React.useEffect(() => {
      const controller = new AbortController();
      setState({ status: "loading", legacyKey: null, publicId: null, error: "" });
      (async () => {
        const rosterCompany = await mbtResolveRosterCompany(companyId);
        if (!rosterCompany?.__apiPublicId) throw new Error("company_not_found");
        const publicId = rosterCompany.__apiPublicId;
        const rich = await mbtFetch(
          "/api/v1/companies/" + encodeURIComponent(publicId) + "/profile",
          controller.signal,
        );
        if (!rich.available || !rich.profile) {
          setState({ status: "api", legacyKey: null, publicId, error: "" });
          return;
        }
        const legacyKey = rich.legacyKey || rich.profile.name || companyId;
        const loadedProfile = {
          ...rich.profile,
          __legacyRichLoaded: true,
          __profilePublicId: publicId,
        };
        window.TASTE_COMPANIES = window.TASTE_COMPANIES || {};
        window.TASTE_COMPANIES[legacyKey] = loadedProfile;
        window.TASTE_COMPANIES[loadedProfile.name] = loadedProfile;
        window.TASTE_SUBCAT = window.TASTE_SUBCAT || {};
        if (rich.subcategory) {
          window.TASTE_SUBCAT[legacyKey] = rich.subcategory;
          window.TASTE_SUBCAT[loadedProfile.name] = rich.subcategory;
        }
        window.TASTE_RELATIONS = window.TASTE_RELATIONS || {};
        Object.assign(window.TASTE_RELATIONS, rich.relationships || {});

        if (loadedProfile.listed) {
          const market = await mbtFetch(
            "/api/v1/companies/" + encodeURIComponent(publicId) + "/market-prices?from=2021-01&to=2026-12",
            controller.signal,
          ).catch((error) => {
            if (error.name === "AbortError") throw error;
            return { available: false, items: [] };
          });
          if (market.available && market.items?.length) {
            window.TASTE_STOCK = window.TASTE_STOCK || {};
            window.TASTE_STOCK[loadedProfile.name] = market.items.map((item) => ({
              m: item.month,
              p: item.closeKrw,
            }));
          }
        }
        setState({ status: "legacy", legacyKey, publicId, error: "" });
      })().catch((error) => {
        if (error.name !== "AbortError") {
          setState({ status: "error", legacyKey: null, publicId: null, error: "기업 상세 정보를 불러오지 못했습니다." });
        }
      });
      return () => controller.abort();
    }, [companyId]);

    if (state.status === "legacy") {
      return <CompanyView companyId={state.legacyKey} onView={onView} />;
    }
    if (state.status === "api") {
      return <ApiCompanyDetailView companyId={state.publicId} onView={onView} />;
    }
    if (state.status === "error") {
      return (
        <main className="page mbt-detail-state">
          <p>{state.error}</p>
          <button type="button" onClick={() => onView({ name: "explorer" })}>기업 검색으로 돌아가기</button>
        </main>
      );
    }
    return <main className="page mbt-detail-state">기업 상세 정보를 불러오는 중입니다.</main>;
  }

  function MbtSearchIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    );
  }

  function HomeCompanySearch({ onView }) {
    const [query, setQuery] = React.useState("");
    const [items, setItems] = React.useState([]);
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
      const normalized = query.trim();
      if (!normalized) {
        setItems([]);
        setOpen(false);
        setLoading(false);
        setError("");
        return undefined;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(async () => {
        setLoading(true);
        setError("");
        try {
          const data = await mbtFetch(
            "/api/v1/companies?q=" + encodeURIComponent(normalized) + "&pageSize=6",
            controller.signal,
          );
          setItems(data.items || []);
          setOpen(true);
          setActiveIndex(-1);
        } catch (fetchError) {
          if (fetchError.name !== "AbortError") {
            setItems([]);
            setOpen(true);
            setError("검색 결과를 불러오지 못했습니다.");
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      }, 280);
      return () => {
        window.clearTimeout(timer);
        controller.abort();
      };
    }, [query]);

    function openCompany(company) {
      setOpen(false);
      onView(mbtCompanyDestination(company));
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open || !items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1));
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        openCompany(items[activeIndex]);
      }
    }

    return (
      <section className="mbt-home-search" aria-label="기업 검색" data-testid="home-company-search">
        <div className="mbt-home-search-copy">
          <span className="mono-eyebrow">Search · 540 Companies</span>
          <strong>궁금한 기업의 숫자를 바로 찾아보세요.</strong>
        </div>
        <div className="mbt-home-search-box">
          <MbtSearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => query.trim() && setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            onKeyDown={onKeyDown}
            placeholder="기업명 또는 법인명 검색 (예: K카, 헤이딜러)"
            aria-label="기업명 검색"
            aria-autocomplete="list"
            aria-expanded={open}
            autoComplete="off"
            data-testid="home-search-input"
          />
          {loading && <span className="mbt-search-loading">검색 중</span>}
          {open && (
            <div className="mbt-home-search-results" role="listbox" data-testid="home-search-results">
              {error && <div className="mbt-search-state">{error}</div>}
              {!error && !loading && items.length === 0 && (
                <div className="mbt-search-state">일치하는 기업이 없습니다.</div>
              )}
              {items.map((company, index) => (
                <button
                  type="button"
                  key={company.publicId}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "active" : ""}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openCompany(company)}
                  data-testid={"home-search-result-" + company.publicId}
                >
                  <span className="mbt-search-result-main">
                    <b>{company.name}</b>
                    <small>{company.legalName || "법인명 미공개"}</small>
                  </span>
                  <span className="mbt-search-result-meta">
                    <em>{mbtIndustryMeta(company).name}</em>
                    <span>{mbtFormatEok(company.latestFinancials?.revenueEok)}</span>
                  </span>
                </button>
              ))}
              {!error && items.length > 0 && (
                <button
                  type="button"
                  className="mbt-search-all"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onView({ name: "explorer", query: query.trim() })}
                >
                  전체 검색 결과 보기 <span>→</span>
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  function CompanyCard({ company, selected, onToggle, onOpen }) {
    const financials = company.latestFinancials;
    return (
      <article className="mbt-explorer-card" data-testid={"company-card-" + company.publicId}>
        <div className="mbt-explorer-card-top">
          <span className="mbt-explorer-index">{mbtIndustryMeta(company).name}</span>
          <label className="mbt-compare-check">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(company)}
              aria-label={company.name + " 비교 선택"}
            />
            <span>비교</span>
          </label>
        </div>
        <button type="button" className="mbt-company-title" onClick={() => onOpen(company)}>
          <strong>{company.name}</strong>
          <span>상세보기 →</span>
        </button>
        <p className="mbt-company-legal">{company.legalName || "법인명 미공개"}</p>
        <div className="mbt-company-tags">
          <span>{mbtListedLabel(company.listed)}</span>
          {financials?.year && <span>{financials.year}년 기준</span>}
        </div>
        <dl className="mbt-card-financials">
          <div><dt>매출</dt><dd>{mbtFormatEok(financials?.revenueEok)}</dd></div>
          <div><dt>영업이익</dt><dd>{mbtFormatEok(financials?.operatingProfitEok)}</dd></div>
          <div><dt>영업이익률</dt><dd>{mbtFormatPercent(financials?.operatingMarginPct)}</dd></div>
        </dl>
      </article>
    );
  }

  const MBT_COMPARE_COLORS = ["#B5321A", "#1A6B5A", "#2D3E68", "#B89249", "#7A2541"];

  function mbtCompactAxis(value) {
    const absolute = Math.abs(value);
    if (absolute >= 10000) {
      const scaled = value / 10000;
      return scaled.toLocaleString("ko-KR", { maximumFractionDigits: absolute >= 100000 ? 0 : 1 }) + "조";
    }
    if (absolute >= 1000) return Math.round(value / 1000).toLocaleString("ko-KR") + "천억";
    return Math.round(value).toLocaleString("ko-KR") + "억";
  }

  function MbtFinancialLineChart({ items, years, metricKey, title }) {
    const width = 620;
    const height = 310;
    const margin = { top: 20, right: 20, bottom: 44, left: 78 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = items.flatMap((item) => item.financials
      .map((row) => row[metricKey])
      .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
      .map(Number));
    let minimum = values.length ? Math.min(0, ...values) : 0;
    let maximum = values.length ? Math.max(0, ...values) : 1;
    if (minimum === maximum) maximum = minimum + 1;
    const padding = Math.max((maximum - minimum) * 0.08, 1);
    if (minimum < 0) minimum -= padding;
    maximum += padding;
    const x = (year) => {
      const index = years.indexOf(year);
      return margin.left + (years.length <= 1 ? plotWidth / 2 : (index / (years.length - 1)) * plotWidth);
    };
    const y = (value) => margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
    const ticks = Array.from({ length: 5 }, (_, index) => maximum - ((maximum - minimum) * index) / 4);

    function linePath(financials) {
      let path = "";
      let drawing = false;
      for (const year of years) {
        const row = financials.find((entry) => entry.year === year);
        const value = row?.[metricKey];
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
          drawing = false;
          continue;
        }
        path += (drawing ? " L " : " M ") + x(year) + " " + y(Number(value));
        drawing = true;
      }
      return path;
    }

    return (
      <article className="mbt-line-chart">
        <div className="mbt-line-chart-title">
          <h3>{title}</h3>
          <span>단위: 억원</span>
        </div>
        <div className="mbt-line-chart-scroll">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
            {ticks.map((tick, index) => (
              <g key={index}>
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="mbt-chart-gridline" />
                <text x={margin.left - 12} y={y(tick) + 4} textAnchor="end" className="mbt-chart-axis-label">{mbtCompactAxis(tick)}</text>
              </g>
            ))}
            {minimum < 0 && maximum > 0 && (
              <line x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} className="mbt-chart-zero" />
            )}
            {years.map((year) => (
              <text key={year} x={x(year)} y={height - 15} textAnchor="middle" className="mbt-chart-year">{year}</text>
            ))}
            {items.map((item, itemIndex) => {
              const color = MBT_COMPARE_COLORS[itemIndex % MBT_COMPARE_COLORS.length];
              return (
                <g key={item.company.publicId}>
                  <path d={linePath(item.financials)} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {years.map((year) => {
                    const row = item.financials.find((entry) => entry.year === year);
                    const value = row?.[metricKey];
                    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
                    return (
                      <circle key={year} cx={x(year)} cy={y(Number(value))} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5">
                        <title>{item.company.name} · {year} · {mbtFormatEok(value)}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </article>
    );
  }

  function mbtFormatKrw(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "원";
  }

  function MbtMarketPriceChart({ data }) {
    const items = data?.items || [];
    if (!items.length) return null;
    const width = 960;
    const height = 350;
    const margin = { top: 24, right: 28, bottom: 46, left: 88 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const values = items.map((item) => Number(item.closeKrw)).filter(Number.isFinite);
    let minimum = Math.min(...values);
    let maximum = Math.max(...values);
    if (minimum === maximum) maximum = minimum + 1;
    const padding = (maximum - minimum) * 0.08;
    minimum = Math.max(0, minimum - padding);
    maximum += padding;
    const x = (index) => margin.left + (items.length <= 1 ? plotWidth / 2 : (index / (items.length - 1)) * plotWidth);
    const y = (value) => margin.top + ((maximum - value) / (maximum - minimum)) * plotHeight;
    const ticks = Array.from({ length: 5 }, (_, index) => maximum - ((maximum - minimum) * index) / 4);
    const path = items.map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(Number(item.closeKrw))}`).join(" ");
    const labels = [...new Map(items.map((item) => [item.month.slice(0, 4), item])).values()];
    const first = Number(items[0].closeKrw);
    const latest = Number(items.at(-1).closeKrw);
    const totalChange = first ? ((latest / first) - 1) * 100 : null;
    return (
      <div className="mbt-market-chart" data-testid="company-market-chart">
        <div className="mbt-market-stats">
          <article><span>최근 월말 종가</span><b>{mbtFormatKrw(latest)}</b><small>{items.at(-1).month}</small></article>
          <article><span>기간 변동률</span><b className={totalChange >= 0 ? "up" : "down"}>{totalChange === null ? "—" : `${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(1)}%`}</b><small>{items[0].month} 대비</small></article>
          <article><span>기간 최고</span><b>{mbtFormatKrw(Math.max(...values))}</b><small>월말 종가 기준</small></article>
          <article><span>기간 최저</span><b>{mbtFormatKrw(Math.min(...values))}</b><small>월말 종가 기준</small></article>
        </div>
        <div className="mbt-market-chart-scroll">
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${data.stock?.name || "기업"} 월별 주가 추이`}>
            <defs>
              <linearGradient id="mbt-market-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#B5321A" stopOpacity=".22" />
                <stop offset="100%" stopColor="#B5321A" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((tick, index) => (
              <g key={index}>
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className="mbt-chart-gridline" />
                <text x={margin.left - 12} y={y(tick) + 4} textAnchor="end" className="mbt-chart-axis-label">{Math.round(tick).toLocaleString("ko-KR")}원</text>
              </g>
            ))}
            <path d={`${path} L ${x(items.length - 1)} ${height - margin.bottom} L ${x(0)} ${height - margin.bottom} Z`} fill="url(#mbt-market-fill)" />
            <path d={path} fill="none" stroke="#B5321A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {labels.map((item) => {
              const index = items.indexOf(item);
              return (
                <g key={item.month}>
                  <circle cx={x(index)} cy={y(Number(item.closeKrw))} r="4" fill="#fff" stroke="#B5321A" strokeWidth="2.5"><title>{item.month} · {mbtFormatKrw(item.closeKrw)}</title></circle>
                  <text x={x(index)} y={height - 16} textAnchor="middle" className="mbt-chart-year">{item.month.slice(0, 4)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  function ComparisonCharts({ data, years }) {
    return (
      <div className="mbt-comparison-charts" data-testid="comparison-charts">
        <div className="mbt-compare-legend" aria-label="비교 기업 범례">
          {data.items.map((item, index) => (
            <span key={item.company.publicId}>
              <i style={{ background: MBT_COMPARE_COLORS[index % MBT_COMPARE_COLORS.length] }} />
              {item.company.name}
            </span>
          ))}
        </div>
        <div className="mbt-chart-grid">
          <MbtFinancialLineChart items={data.items} years={years} metricKey="revenueEok" title="매출 추이" />
          <MbtFinancialLineChart items={data.items} years={years} metricKey="operatingProfitEok" title="영업이익 추이" />
        </div>
      </div>
    );
  }

  function ComparisonPanel({ data, onClose }) {
    if (!data?.items?.length) return null;
    const years = Array.from(new Set(data.items.flatMap((item) => item.financials.map((row) => row.year)))).sort();
    return (
      <section className="mbt-comparison" data-testid="comparison-panel">
        <div className="mbt-comparison-head">
          <div>
            <span className="mono-eyebrow">Compare · Financial Snapshot</span>
            <h2>선택 기업 비교</h2>
          </div>
          <button type="button" onClick={onClose}>비교표 닫기 ×</button>
        </div>
        <ComparisonCharts data={data} years={years} />
        <div className="mbt-compare-scroll">
          <table>
            <thead>
              <tr>
                <th>연도 / 항목</th>
                {data.items.map((item) => <th key={item.company.publicId}>{item.company.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {years.flatMap((year) => [
                <tr key={year + "-revenue"}>
                  <th>{year} 매출</th>
                  {data.items.map((item) => {
                    const row = item.financials.find((entry) => entry.year === year);
                    return <td key={item.company.publicId}>{mbtFormatEok(row?.revenueEok)}</td>;
                  })}
                </tr>,
                <tr key={year + "-profit"}>
                  <th>{year} 영업이익</th>
                  {data.items.map((item) => {
                    const row = item.financials.find((entry) => entry.year === year);
                    return <td key={item.company.publicId}>{mbtFormatEok(row?.operatingProfitEok)}</td>;
                  })}
                </tr>,
                <tr key={year + "-margin"}>
                  <th>{year} 영업이익률</th>
                  {data.items.map((item) => {
                    const row = item.financials.find((entry) => entry.year === year);
                    return <td key={item.company.publicId}>{mbtFormatPercent(row?.operatingMarginPct)}</td>;
                  })}
                </tr>,
              ])}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  function CompanyExplorerView({ onView, initialQuery = "" }) {
    const [query, setQuery] = React.useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = React.useState(initialQuery);
    const [industry, setIndustry] = React.useState("");
    const [listed, setListed] = React.useState("");
    const [page, setPage] = React.useState(1);
    const [industries, setIndustries] = React.useState([]);
    const [result, setResult] = React.useState({ items: [], total: 0, pageCount: 0 });
    const [selected, setSelected] = React.useState([]);
    const [comparison, setComparison] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");
    const [compareLoading, setCompareLoading] = React.useState(false);

    React.useEffect(() => {
      const timer = window.setTimeout(() => {
        setDebouncedQuery(query.trim());
        setPage(1);
      }, 300);
      return () => window.clearTimeout(timer);
    }, [query]);

    React.useEffect(() => {
      const controller = new AbortController();
      mbtFetch("/api/v1/industries", controller.signal)
        .then((data) => setIndustries(data.items || []))
        .catch((fetchError) => {
          if (fetchError.name !== "AbortError") setError("산업 목록을 불러오지 못했습니다.");
        });
      return () => controller.abort();
    }, []);

    React.useEffect(() => {
      const controller = new AbortController();
      const params = new URLSearchParams({ page: String(page), pageSize: "18" });
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (industry) params.set("industry", industry);
      if (listed) params.set("listed", listed);
      setLoading(true);
      setError("");
      mbtFetch("/api/v1/companies?" + params.toString(), controller.signal)
        .then((data) => setResult(data))
        .catch((fetchError) => {
          if (fetchError.name !== "AbortError") setError("기업 목록을 불러오지 못했습니다.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [debouncedQuery, industry, listed, page]);

    function toggleCompany(company) {
      setComparison(null);
      setSelected((current) => {
        if (current.some((item) => item.publicId === company.publicId)) {
          return current.filter((item) => item.publicId !== company.publicId);
        }
        if (current.length >= 5) return current;
        return [...current, company];
      });
    }

    async function compare() {
      if (selected.length < 2) return;
      setCompareLoading(true);
      setError("");
      try {
        const ids = selected.map((company) => company.publicId).join(",");
        const data = await mbtFetch("/api/v1/compare?ids=" + encodeURIComponent(ids));
        setComparison(data);
        window.setTimeout(() => document.querySelector(".mbt-comparison")?.scrollIntoView({ behavior: "smooth" }), 0);
      } catch (fetchError) {
        setError("비교 데이터를 불러오지 못했습니다.");
      } finally {
        setCompareLoading(false);
      }
    }

    return (
      <main className="page mbt-explorer-page" data-testid="company-explorer">
        <div className="hero-eyebrow">
          <div className="rule" />
          <span className="mono-eyebrow">Database · Search & Compare</span>
        </div>
        <div className="mbt-explorer-hero">
          <div>
            <h1>기업 검색·비교</h1>
            <p>540개 기업의 공개 재무 데이터에서 원하는 회사를 찾고, 최대 5개 기업을 같은 기준으로 비교합니다.</p>
          </div>
          <div className="mbt-explorer-count"><b>540</b><span>FROZEN COMPANIES</span></div>
        </div>

        <section className="mbt-explorer-controls" aria-label="기업 검색 조건">
          <label className="mbt-explorer-query">
            <MbtSearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="기업명 또는 법인명"
              aria-label="기업 검색"
              data-testid="explorer-search-input"
            />
          </label>
          <label>
            <span>산업</span>
            <select value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }}>
              <option value="">전체 산업</option>
              {industries.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.companyCount})</option>)}
            </select>
          </label>
          <label>
            <span>상장 구분</span>
            <select value={listed} onChange={(event) => { setListed(event.target.value); setPage(1); }}>
              <option value="">전체</option>
              <option value="true">상장</option>
              <option value="false">비상장</option>
            </select>
          </label>
        </section>

        <div className="mbt-explorer-summary">
          <p><b>{result.total?.toLocaleString("ko-KR") || 0}</b>개 기업</p>
          <span>금액 단위: 억원 · 결측치는 —로 표시</span>
        </div>

        {error && <div className="mbt-explorer-error" role="alert">{error}</div>}
        {loading ? (
          <div className="mbt-explorer-loading">기업 데이터를 불러오는 중입니다.</div>
        ) : result.items?.length ? (
          <div className="mbt-explorer-grid">
            {result.items.map((company) => (
              <CompanyCard
                key={company.publicId}
                company={company}
                selected={selected.some((item) => item.publicId === company.publicId)}
                onToggle={toggleCompany}
                onOpen={(item) => onView(mbtCompanyDestination(item))}
              />
            ))}
          </div>
        ) : (
          <div className="mbt-explorer-empty">조건에 맞는 기업이 없습니다.</div>
        )}

        {result.pageCount > 1 && (
          <nav className="mbt-pagination" aria-label="기업 목록 페이지">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← 이전</button>
            <span>{page} / {result.pageCount}</span>
            <button type="button" disabled={page >= result.pageCount} onClick={() => setPage((value) => value + 1)}>다음 →</button>
          </nav>
        )}

        {comparison && <ComparisonPanel data={comparison} onClose={() => setComparison(null)} />}

        {selected.length > 0 && (
          <aside className="mbt-compare-tray" data-testid="compare-tray">
            <div>
              <span>비교할 기업</span>
              <div>{selected.map((company) => <b key={company.publicId}>{company.name}</b>)}</div>
            </div>
            <div className="mbt-compare-actions">
              <button type="button" className="secondary" onClick={() => { setSelected([]); setComparison(null); }}>초기화</button>
              <button type="button" disabled={selected.length < 2 || compareLoading} onClick={compare} data-testid="compare-button">
                {compareLoading ? "불러오는 중" : selected.length < 2 ? "1개 더 선택" : selected.length + "개 기업 비교"}
              </button>
            </div>
          </aside>
        )}
      </main>
    );
  }

  function mbtCompanyAnalysis(company, financials) {
    const rows = [...financials].sort((left, right) => Number(left.year) - Number(right.year));
    const latest = rows.at(-1);
    const previous = rows.at(-2);
    const positive = [];
    const risks = [];
    let summary = "공개 DB에서 확인된 기업 정보와 인력 데이터를 중심으로 살펴봅니다.";
    if (latest?.revenueEok !== null && latest?.revenueEok !== undefined) {
      summary = `${latest.year}년 매출 ${mbtFormatEok(latest.revenueEok)}, 영업이익률 ${mbtFormatPercent(latest.operatingMarginPct)}를 기록했습니다.`;
      if (previous?.revenueEok) {
        const growth = ((Number(latest.revenueEok) - Number(previous.revenueEok)) / Math.abs(Number(previous.revenueEok))) * 100;
        const item = {
          title: growth >= 0 ? "최근 매출 증가" : "최근 매출 감소",
          body: `${previous.year}년 대비 ${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% 변동했습니다.`,
        };
        (growth >= 0 ? positive : risks).push(item);
      }
      if (latest.operatingMarginPct !== null && latest.operatingMarginPct !== undefined) {
        const margin = Number(latest.operatingMarginPct);
        const item = {
          title: margin >= 0 ? "영업 흑자 구조" : "영업 손실 구간",
          body: `${latest.year}년 영업이익률은 ${mbtFormatPercent(margin)}입니다.`,
        };
        (margin >= 0 ? positive : risks).push(item);
      }
    } else {
      risks.push({
        title: "재무 시계열 미수록",
        body: "현재 공개 DB에는 검증 완료된 매출·영업이익 시계열이 없습니다. 보고서 추출 완료 후 보강합니다.",
      });
    }
    if (company.workforce?.employees) {
      positive.push({
        title: "인력 지표 확인",
        body: `${company.workforce.year}년 임직원 ${company.workforce.employees.toLocaleString("ko-KR")}명이 공개 데이터 계층에 연결돼 있습니다.`,
      });
    }
    if (!positive.length) positive.push({ title: "공개 프로필 연결", body: "기업명·법인명·산업 분류를 공개 DB 동결본에서 확인했습니다." });
    if (!risks.length) risks.push({ title: "결측치 확인 필요", body: "공개되지 않았거나 검증이 끝나지 않은 항목은 —로 표시합니다." });
    return { summary, positive: positive.slice(0, 3), risks: risks.slice(0, 3) };
  }

  function ApiCompanyDetailView({ companyId, onView }) {
    const [company, setCompany] = React.useState(null);
    const [financials, setFinancials] = React.useState([]);
    const [marketData, setMarketData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
      const controller = new AbortController();
      setLoading(true);
      setError("");
      Promise.all([
        mbtFetch("/api/v1/companies/" + encodeURIComponent(companyId), controller.signal),
        mbtFetch("/api/v1/companies/" + encodeURIComponent(companyId) + "/financials?from=2021&to=2025", controller.signal),
        mbtFetch("/api/v1/companies/" + encodeURIComponent(companyId) + "/market-prices?from=2021-01&to=2026-12", controller.signal)
          .catch((marketError) => marketError.name === "AbortError" ? Promise.reject(marketError) : ({ available: false, items: [], loadError: true })),
      ])
        .then(([detail, history, market]) => {
          setCompany(detail.company);
          setFinancials(history.items || []);
          setMarketData(market);
        })
        .catch((fetchError) => {
          if (fetchError.name !== "AbortError") setError("기업 상세 정보를 불러오지 못했습니다.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [companyId]);

    if (loading) return <main className="page mbt-detail-state">기업 상세 정보를 불러오는 중입니다.</main>;
    if (error || !company) {
      return (
        <main className="page mbt-detail-state">
          <p>{error || "기업 정보를 찾을 수 없습니다."}</p>
          <button type="button" onClick={() => onView({ name: "explorer" })}>기업 검색으로 돌아가기</button>
        </main>
      );
    }

    const latest = company.latestFinancials;
    const industry = mbtIndustryMeta(company);
    const description = company.description && !(latest && /후속 추출 필요/.test(company.description))
      ? company.description
      : `${industry.detail} 분야에서 사업을 전개하는 ${company.name}의 공개 기업 프로필입니다.`;
    const years = financials.map((row) => row.year).sort();
    const analysis = mbtCompanyAnalysis(company, financials);
    const revenuePerEmployee = latest?.revenueEok != null && company.workforce?.employees
      ? Number(latest.revenueEok) / Number(company.workforce.employees)
      : null;
    const peers = Object.values(window.TASTE_COMPANIES || {})
      .filter((item) => item.name !== company.name && item.industry === industry.id)
      .sort((left, right) => (
        Number(right.revenue?.["2025"] ?? right.revenue?.["2024"] ?? 0) -
        Number(left.revenue?.["2025"] ?? left.revenue?.["2024"] ?? 0)
      ))
      .slice(0, 8);
    const chartItems = [{ company, financials }];
    return (
      <main className="page mbt-api-company" data-testid="api-company-detail">
        <nav className="co-breadcrumb" aria-label="현재 위치">
          <span className="crumb" role="button" tabIndex="0" onClick={() => onView({ name: "home" })}>홈</span>
          <span className="sep">/</span>
          <span className="crumb" role="button" tabIndex="0" onClick={() => onView({ name: "industry", id: industry.id })}>{industry.name}</span>
          <span className="sep">/</span>
          <b style={{ color: industry.color }}>{company.name}</b>
        </nav>

        <section className="mbt-detail-hero" style={{ "--c": industry.color }}>
          <div>
            <span className="mono-eyebrow">Company · {company.publicId}</span>
            <h1 data-testid="company-detail-name">{company.name}</h1>
            <p className="mbt-detail-legal">{company.legalName || "법인명 미공개"}</p>
            <div className="mbt-detail-tags">
              <span style={{ borderColor: industry.color, color: industry.color }}>{industry.name}</span>
              <span>{mbtListedLabel(company.listed)}</span>
              {company.foundedYear && <span>{company.foundedYear}년 설립</span>}
            </div>
          </div>
          <div className="mbt-detail-mark" style={{ background: industry.color }} aria-hidden="true">{company.name.slice(0, 1)}</div>
        </section>

        <p className="mbt-detail-description">{description}</p>

        <section className="mbt-detail-kpis" aria-label="최근 재무 요약">
          <article><span>최근 매출</span><b>{mbtFormatEok(latest?.revenueEok)}</b><small>{latest?.year ? latest.year + "년" : "공개 DB 재무 시계열 미수록"}</small></article>
          <article><span>영업이익률</span><b>{mbtFormatPercent(latest?.operatingMarginPct)}</b><small>{latest?.year ? latest.year + "년" : "공개 DB 재무 시계열 미수록"}</small></article>
          <article><span>1인당 매출</span><b>{revenuePerEmployee === null ? "—" : revenuePerEmployee.toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "억원"}</b><small>{revenuePerEmployee === null ? "산출 가능한 재무·인력 조합 없음" : "최근 매출 ÷ 임직원"}</small></article>
          <article><span>임직원</span><b>{company.workforce?.employees?.toLocaleString("ko-KR") || "—"}{company.workforce?.employees ? "명" : ""}</b><small>{company.workforce?.year ? company.workforce.year + "년" : "기준연도 없음"}</small></article>
        </section>

        <section className="mbt-detail-info">
          <div className="mbt-detail-section-head">
            <div><span className="mono-eyebrow">Profile · 기업 정보</span><h2>기업 개요</h2></div>
          </div>
          <dl>
            <div><dt>법인명</dt><dd>{company.legalName || "—"}</dd></div>
            <div><dt>산업</dt><dd>{industry.name} · {industry.detail}</dd></div>
            <div><dt>본사</dt><dd>{company.headquarters || "—"}</dd></div>
            <div><dt>설립</dt><dd>{company.foundedYear ? company.foundedYear + "년" : "—"}</dd></div>
            <div><dt>상장 구분</dt><dd>{mbtListedLabel(company.listed)}</dd></div>
            <div><dt>종목</dt><dd>{company.stock ? `${company.stock.ticker} · ${company.stock.market || "시장 확인 중"}` : "—"}</dd></div>
            <div><dt>데이터 기준</dt><dd>Money Behind Taste 공개 DB 동결본</dd></div>
          </dl>
        </section>

        <section className="mbt-detail-financials">
          <div className="mbt-detail-section-head">
            <div><span className="mono-eyebrow">Financials · 2021–2025</span><h2>재무 추이</h2></div>
            <p>금액 단위: 억원</p>
          </div>
          {financials.length ? (
            <div className="mbt-comparison-charts mbt-detail-charts" data-testid="company-financial-charts">
              <div className="mbt-chart-grid">
                <MbtFinancialLineChart items={chartItems} years={years} metricKey="revenueEok" title="매출 추이" />
                <MbtFinancialLineChart items={chartItems} years={years} metricKey="operatingProfitEok" title="영업이익 추이" />
              </div>
            </div>
          ) : (
            <div className="mbt-detail-no-financials" data-testid="company-financials-empty">
              <b>공개 DB 재무 시계열 미수록</b>
              <p>보고서 파일이 존재하더라도 검증된 숫자 추출이 끝나지 않은 경우에는 0이나 추정치를 표시하지 않습니다.</p>
            </div>
          )}
          <div className="mbt-financial-scroll">
            <table>
              <thead><tr><th>연도</th><th>매출</th><th>영업이익</th><th>영업이익률</th><th>기준</th><th>상태</th></tr></thead>
              <tbody>
                {financials.length ? financials.map((row) => (
                  <tr key={row.year}>
                    <th>{row.year}</th>
                    <td>{mbtFormatEok(row.revenueEok)}</td>
                    <td>{mbtFormatEok(row.operatingProfitEok)}</td>
                    <td>{mbtFormatPercent(row.operatingMarginPct)}</td>
                    <td>{row.basis || "—"}</td>
                    <td>{row.dataStatus || "—"}</td>
                  </tr>
                )) : <tr><td colSpan="6">공개 가능한 재무 시계열이 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mbt-data-note">공개 데이터 계층의 동결본을 기준으로 표시합니다. 결측치와 비공개 값은 —로 표기합니다.</p>
        </section>

        {company.listed && (
          <section className="mbt-detail-market">
            <div className="mbt-detail-section-head">
              <div><span className="mono-eyebrow">Market · 2021–현재</span><h2>5개년 주가 흐름</h2></div>
              <p>{company.stock ? `${company.stock.ticker} · ${company.stock.market || "KRX"}` : "상장 종목 연결 확인 중"}</p>
            </div>
            {marketData?.available ? (
              <>
                <MbtMarketPriceChart data={marketData} />
                <p className="mbt-market-source">
                  출처: {marketData.source?.url ? <a href={marketData.source.url} target="_blank" rel="noreferrer">{marketData.source.label}</a> : marketData.source?.label}
                  <span>월말 종가 · 기업행동 조정 전 가격</span>
                </p>
              </>
            ) : (
              <div className="mbt-detail-no-financials" data-testid="company-market-empty">
                <b>공개 주가 시계열 준비 중</b>
                <p>{marketData?.loadError ? "주가 API를 일시적으로 불러오지 못했습니다." : "공개 원천에서 확인된 월별 주가가 아직 연결되지 않았습니다."}</p>
              </div>
            )}
          </section>
        )}

        <section className="mbt-detail-analysis">
          <div className="mbt-detail-section-head">
            <div><span className="mono-eyebrow">Editorial Take · 데이터 해석</span><h2>이 기업의 숫자 읽기</h2></div>
          </div>
          <blockquote style={{ borderColor: industry.color }}>{analysis.summary}</blockquote>
          <div className="mbt-detail-analysis-grid">
            <article className="positive">
              <h3>확인된 포인트</h3>
              {analysis.positive.map((item) => <div key={item.title}><b>{item.title}</b><p>{item.body}</p></div>)}
            </article>
            <article className="risk">
              <h3>확인·보강할 포인트</h3>
              {analysis.risks.map((item) => <div key={item.title}><b>{item.title}</b><p>{item.body}</p></div>)}
            </article>
          </div>
        </section>

        <section className="mbt-detail-peers">
          <div className="mbt-detail-section-head">
            <div><span className="mono-eyebrow">Industry Peers · {industry.name}</span><h2>같은 산업의 기업</h2></div>
            <p>최근 공개 매출 기준 정렬</p>
          </div>
          <div className="mbt-peer-grid">
            {peers.map((peer) => (
              <button type="button" key={peer.name} onClick={() => onView(mbtCompanyDestination(peer))}>
                <span>{peer.name}</span>
                <b>{mbtFormatEok(peer.revenue?.["2025"] ?? peer.revenue?.["2024"])}</b>
                <i>상세보기 →</i>
              </button>
            ))}
          </div>
        </section>

        <section className="mbt-book-link" style={{ "--c": industry.color }}>
          <div className="mbt-book-mark">좋아하는<br/>것들의<br/>재무제표</div>
          <div><span>From the Book</span><h3>{company.name}의 재무제표에서 발견한 것들</h3><p>공개 DB와 책의 분석 관점을 연결하는 기업 페이지입니다.</p></div>
        </section>
      </main>
    );
  }

  window.HomeCompanySearch = HomeCompanySearch;
  window.CompanyExplorerView = CompanyExplorerView;
  window.ApiCompanyDetailView = ApiCompanyDetailView;
  window.PublicRosterBootstrap = PublicRosterBootstrap;
  window.CompanyProfileResolver = CompanyProfileResolver;
  window.mbtCompanyDestination = mbtCompanyDestination;
})();
