import React, { useEffect, useState, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

interface DailyReport {
  date: string;
  totalTime: number;
  topSites: {
    url: string;
    title: string;
    duration: number;
    percentage: number;
  }[];
}

type Period = "day" | "week" | "month" | "year";

const getLastNDates = (n: number) => {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
};

const getLastNMonths = (n: number) => {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return months;
};

// Heuristic-based categorization keywords
const CATEGORY_KEYWORDS: Record<string, string> = {
  youtube: "Entertainment",
  netflix: "Entertainment",
  facebook: "Social",
  twitter: "Social",
  linkedin: "Work",
  github: "Work",
  stackoverflow: "Work",
  gmail: "Communication",
  "mail.google": "Communication",
  reddit: "Social",
  wikipedia: "Education",
  medium: "Education",
  news: "News",
  blog: "Blog",
  shop: "Shopping",
  amazon: "Shopping",
  flipkart: "Shopping",
  bank: "Finance",
  finance: "Finance",
  // Add more as needed
};

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function getCategory(url: string): Promise<string> {
  const domain = getDomain(url);
  // Check user-assigned category in storage
  const userCatKey = `cat_user_${domain}`;
  const userCat = await chrome.storage.local.get(userCatKey);
  if (userCat[userCatKey]) return userCat[userCatKey];
  // Heuristic: check keywords
  for (const keyword in CATEGORY_KEYWORDS) {
    if (domain.includes(keyword)) return CATEGORY_KEYWORDS[keyword];
  }
  return "Other";
}

const DailyReport: React.FC = () => {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [trendData, setTrendData] = useState<
    { label: string; totalTime: number }[]
  >([]);
  const [period, setPeriod] = useState<Period>("week");
  const [tooltip, setTooltip] = useState<{
    content: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [categoryAssignments, setCategoryAssignments] = useState<
    Record<string, string>
  >({});
  const [showCategoryPrompt, setShowCategoryPrompt] = useState<{
    domain: string;
    onAssign: (cat: string) => void;
  } | null>(null);
  const [categoryData, setCategoryData] = useState<
    { category: string; duration: number }[]
  >([]);
  const [editCategoryDomain, setEditCategoryDomain] = useState<string | null>(
    null
  );
  const [editCategoryValue, setEditCategoryValue] = useState<string>("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    const fetchReport = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const today = new Date().toISOString().split("T")[0];
      const startOfDay = new Date(today);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "users", currentUser.uid, "activity"),
        where("startTime", ">=", Timestamp.fromDate(startOfDay)),
        where("startTime", "<=", Timestamp.fromDate(endOfDay))
      );

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map((doc) => doc.data());

      // Calculate report data
      const urlStats: Record<
        string,
        { url: string; title: string; duration: number }
      > = {};

      records.forEach((record) => {
        const key = record.url;
        if (!urlStats[key]) {
          urlStats[key] = {
            url: record.url,
            title: record.title,
            duration: 0,
          };
        }
        urlStats[key].duration += record.duration;
      });

      const totalTime = Object.values(urlStats).reduce(
        (sum, stat) => sum + stat.duration,
        0
      );

      const topSites = Object.values(urlStats)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map((site) => ({
          ...site,
          percentage: (site.duration / totalTime) * 100,
        }));

      setReport({
        date: today,
        totalTime,
        topSites,
      });
    };

    const fetchTrendData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      if (period === "day") {
        const today = new Date().toISOString().split("T")[0];
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
          collection(db, "users", currentUser.uid, "activity"),
          where("startTime", ">=", Timestamp.fromDate(startOfDay)),
          where("startTime", "<=", Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map((doc) => doc.data());
        let total = 0;

        const urlStats: Record<string, { duration: number }> = {};
        records.forEach((record) => {
          const key = record.url;
          if (!urlStats[key]) urlStats[key] = { duration: 0 };
          urlStats[key].duration += record.duration;
        });

        total = Object.values(urlStats).reduce(
          (sum, stat) => sum + stat.duration,
          0
        );

        setTrendData([{ label: today, totalTime: total }]);
      } else if (period === "week") {
        const dates = getLastNDates(7);
        const trend = await Promise.all(
          dates.map(async (date) => {
            const startOfDay = new Date(date);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const q = query(
              collection(db, "users", currentUser.uid, "activity"),
              where("startTime", ">=", Timestamp.fromDate(startOfDay)),
              where("startTime", "<=", Timestamp.fromDate(endOfDay))
            );

            const querySnapshot = await getDocs(q);
            const records = querySnapshot.docs.map((doc) => doc.data());
            let total = 0;

            const urlStats: Record<string, { duration: number }> = {};
            records.forEach((record) => {
              const key = record.url;
              if (!urlStats[key]) urlStats[key] = { duration: 0 };
              urlStats[key].duration += record.duration;
            });

            total = Object.values(urlStats).reduce(
              (sum, stat) => sum + stat.duration,
              0
            );

            return { label: date, totalTime: total };
          })
        );
        setTrendData(trend);
      } else if (period === "month") {
        const days = getLastNDates(30);
        const weekMap: Record<string, number> = {};

        await Promise.all(
          days.map(async (date) => {
            const week = `${date.slice(0, 7)}-W${Math.ceil(
              Number(date.slice(8, 10)) / 7
            )}`;

            const startOfDay = new Date(date);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const q = query(
              collection(db, "users", currentUser.uid, "activity"),
              where("startTime", ">=", Timestamp.fromDate(startOfDay)),
              where("startTime", "<=", Timestamp.fromDate(endOfDay))
            );

            const querySnapshot = await getDocs(q);
            const records = querySnapshot.docs.map((doc) => doc.data());
            let total = 0;

            const urlStats: Record<string, { duration: number }> = {};
            records.forEach((record) => {
              const key = record.url;
              if (!urlStats[key]) urlStats[key] = { duration: 0 };
              urlStats[key].duration += record.duration;
            });

            total = Object.values(urlStats).reduce(
              (sum, stat) => sum + stat.duration,
              0
            );

            weekMap[week] = (weekMap[week] || 0) + total;
          })
        );

        setTrendData(
          Object.entries(weekMap).map(([label, totalTime]) => ({
            label,
            totalTime,
          }))
        );
      } else if (period === "year") {
        const months = getLastNMonths(12);
        const monthMap: Record<string, number> = {};

        await Promise.all(
          months.map(async (month) => {
            const [year, m] = month.split("-");
            const startOfMonth = new Date(Number(year), Number(m) - 1, 1);
            const endOfMonth = new Date(Number(year), Number(m), 0);
            endOfMonth.setHours(23, 59, 59, 999);

            const q = query(
              collection(db, "users", currentUser.uid, "activity"),
              where("startTime", ">=", Timestamp.fromDate(startOfMonth)),
              where("startTime", "<=", Timestamp.fromDate(endOfMonth))
            );

            const querySnapshot = await getDocs(q);
            const records = querySnapshot.docs.map((doc) => doc.data());
            let total = 0;

            const urlStats: Record<string, { duration: number }> = {};
            records.forEach((record) => {
              const key = record.url;
              if (!urlStats[key]) urlStats[key] = { duration: 0 };
              urlStats[key].duration += record.duration;
            });

            total = Object.values(urlStats).reduce(
              (sum, stat) => sum + stat.duration,
              0
            );

            monthMap[month] = total;
          })
        );

        setTrendData(
          Object.entries(monthMap).map(([label, totalTime]) => ({
            label,
            totalTime,
          }))
        );
      }
    };

    fetchReport();
    fetchTrendData();
    const interval = setInterval(() => {
      fetchReport();
      fetchTrendData();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [period, auth.currentUser]);

  useEffect(() => {
    async function computeCategoryData() {
      if (!report) return;
      const stats: Record<string, number> = {};
      for (const site of report.topSites) {
        const domain = getDomain(site.url);
        let category = categoryAssignments[domain];
        if (!category) {
          category = await getCategory(site.url);
          if (category === "Other") {
            // Prompt user for unknown category
            setShowCategoryPrompt({
              domain,
              onAssign: async (cat: string) => {
                await chrome.storage.local.set({ [`cat_user_${domain}`]: cat });
                setCategoryAssignments((prev) => ({ ...prev, [domain]: cat }));
                setShowCategoryPrompt(null);
              },
            });
          }
        }
        stats[category] = (stats[category] || 0) + site.duration;
      }
      setCategoryData(
        Object.entries(stats).map(([category, duration]) => ({
          category,
          duration,
        }))
      );
    }
    computeCategoryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, categoryAssignments]);

  const handleMouseEnter = (e: React.MouseEvent, content: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      content,
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const handleExportXLSX = async () => {
    const all = await chrome.storage.local.get(null);
    const allRecords: {
      date: string;
      url: string;
      title: string;
      startTime: number;
      endTime: number;
      duration: number;
    }[] = [];
    Object.keys(all).forEach((date) => {
      if (Array.isArray(all[date])) {
        (
          all[date] as {
            url: string;
            title: string;
            startTime: number;
            endTime: number;
            duration: number;
          }[]
        ).forEach((rec) => {
          allRecords.push({ date, ...rec });
        });
      }
    });
    if (allRecords.length === 0) {
      alert("No data to export!");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(allRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BrowsingData");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      "browser_journal_data.xlsx"
    );
  };

  const handleExportJSON = async () => {
    const all = await chrome.storage.local.get(null);
    const allRecords: {
      date: string;
      url: string;
      title: string;
      startTime: number;
      endTime: number;
      duration: number;
    }[] = [];
    Object.keys(all).forEach((date) => {
      if (Array.isArray(all[date])) {
        (
          all[date] as {
            url: string;
            title: string;
            startTime: number;
            endTime: number;
            duration: number;
          }[]
        ).forEach((rec) => {
          allRecords.push({ date, ...rec });
        });
      }
    });
    if (allRecords.length === 0) {
      alert("No data to export!");
      return;
    }
    const blob = new Blob([JSON.stringify(allRecords, null, 2)], {
      type: "application/json",
    });
    saveAs(blob, "browser_journal_data.json");
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const canvas = await html2canvas(reportRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    // Calculate image dimensions to fit A4
    const imgWidth = pageWidth - 40;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
    pdf.save("browser_journal_report.pdf");
  };

  if (!report) {
    return <div>Loading...</div>;
  }

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const COLORS = [
    "#42a5f5",
    "#7e57c2",
    "#66bb6a",
    "#ffa726",
    "#ef5350",
    "#ab47bc",
    "#26c6da",
    "#d4e157",
    "#ff7043",
    "#8d6e63",
  ];

  const availableCategories = [
    "All",
    ...categoryData
      .map((c) => c.category)
      .filter((v, i, a) => a.indexOf(v) === i),
  ];

  const filteredSites = report.topSites.filter((site) => {
    const matchesSearch =
      site.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.url.toLowerCase().includes(searchTerm.toLowerCase());
    const domain = getDomain(site.url);
    let category = categoryAssignments[domain];
    if (!category) category = "Other";
    const matchesCategory =
      categoryFilter === "All" || category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div ref={reportRef} className="daily-report">
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ position: "relative" }}>
          <button
            ref={exportBtnRef}
            onClick={() => setShowExportMenu((v) => !v)}
            style={{
              padding: "7px 20px",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(90deg, #42a5f5 0%, #7e57c2 100%)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              boxShadow: "0 2px 8px rgba(60,72,88,0.10)",
              cursor: "pointer",
              letterSpacing: 0.5,
            }}
          >
            Export ▼
          </button>
          {showExportMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 44,
                background: "#fff",
                border: "1px solid #1976d2",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(60,72,88,0.13)",
                zIndex: 20,
                minWidth: 180,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: 500,
                  color: "#1976d2",
                  borderBottom: "1px solid #e3eafc",
                  background: "#f8fafc",
                }}
                onClick={() => {
                  handleExportXLSX();
                  setShowExportMenu(false);
                }}
              >
                Export to XLSX
              </div>
              <div
                style={{
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: 500,
                  color: "#1976d2",
                  borderBottom: "1px solid #e3eafc",
                  background: "#f8fafc",
                }}
                onClick={() => {
                  handleExportJSON();
                  setShowExportMenu(false);
                }}
              >
                Export to JSON
              </div>
              <div
                style={{
                  padding: "12px 20px",
                  cursor: "pointer",
                  fontWeight: 500,
                  color: "#1976d2",
                  background: "#f8fafc",
                }}
                onClick={() => {
                  handleExportPDF();
                  setShowExportMenu(false);
                }}
              >
                Export to PDF
              </div>
            </div>
          )}
        </div>
      </div>
      <h2>Daily Activity Report</h2>
      <p className="date">{new Date(report.date).toLocaleDateString()}</p>
      <p className="total-time">
        Total Browsing Time: {formatDuration(report.totalTime)}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h3 style={{ margin: 0, flex: 1 }}>Browsing Time</h3>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
      </div>
      <div style={{ width: "100%", height: 180, marginBottom: 18 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={trendData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickFormatter={(d) => {
                if (period === "day") {
                  // Show hour:minute for today
                  const date = new Date(d);
                  return date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } else if (period === "week") {
                  // Show date (MM-DD)
                  return d.slice(5);
                } else if (period === "month") {
                  // Show week number (e.g., W1, W2, ...)
                  const weekMatch = d.match(/-W(\d+)/);
                  return weekMatch ? `W${weekMatch[1]}` : d;
                } else if (period === "year") {
                  // Show month name
                  const [year, month] = d.split("-");
                  return new Date(
                    Number(year),
                    Number(month) - 1
                  ).toLocaleString("default", { month: "short" });
                }
                return d;
              }}
              fontSize={12}
            />
            <YAxis tickFormatter={formatDuration} fontSize={12} width={60} />
            <Tooltip
              formatter={formatDuration}
              labelFormatter={(d) => `Date: ${d}`}
            />
            <Bar dataKey="totalTime" fill="#42a5f5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown Pie Chart */}
      <h3>Category Breakdown</h3>
      <div style={{ width: "100%", height: 220, marginBottom: 18 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              dataKey="duration"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={70}
              label={({ category }) => category}
            >
              {categoryData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={formatDuration} />
            <Legend
              content={({ payload }) => (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {payload?.map((entry: { value: string }, i: number) => {
                    const category = entry.value;
                    // Find a domain for this category (first match)
                    const domain = Object.keys(categoryAssignments).find(
                      (d) => categoryAssignments[d] === category
                    );
                    return (
                      <li
                        key={category}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            background: COLORS[i % COLORS.length],
                            display: "inline-block",
                            borderRadius: 2,
                          }}
                        />
                        <span>{category}</span>
                        {domain && (
                          <button
                            style={{
                              marginLeft: 6,
                              fontSize: 12,
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "1px solid #ccc",
                              background: "#f4f6fb",
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setEditCategoryDomain(domain);
                              setEditCategoryValue(category);
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {editCategoryDomain && (
        <div className="category-prompt-modal">
          <div className="category-prompt-content">
            <h4>Edit Category</h4>
            <p>
              Edit category for <b>{editCategoryDomain}</b>:
            </p>
            <input
              type="text"
              value={editCategoryValue}
              onChange={(e) => setEditCategoryValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editCategoryValue) {
                  chrome.storage.local
                    .set({
                      [`cat_user_${editCategoryDomain}`]: editCategoryValue,
                    })
                    .then(() => {
                      setCategoryAssignments((prev) => ({
                        ...prev,
                        [editCategoryDomain]: editCategoryValue,
                      }));
                      setEditCategoryDomain(null);
                    });
                }
              }}
            />
            <button onClick={() => setEditCategoryDomain(null)}>Cancel</button>
            <button
              onClick={() => {
                if (editCategoryValue) {
                  chrome.storage.local
                    .set({
                      [`cat_user_${editCategoryDomain}`]: editCategoryValue,
                    })
                    .then(() => {
                      setCategoryAssignments((prev) => ({
                        ...prev,
                        [editCategoryDomain]: editCategoryValue,
                      }));
                      setEditCategoryDomain(null);
                    });
                }
              }}
              style={{ marginLeft: 8 }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          margin: "18px 0 10px 0",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          placeholder="Search sites..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 2,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        >
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <h3>Most Visited Sites</h3>
      <div className="top-sites">
        {filteredSites.map((site, index) => (
          <div key={site.url} className="site-stat">
            <div className="site-header">
              <span className="rank">{index + 1}</span>
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ellipsis"
                onMouseEnter={(e) =>
                  handleMouseEnter(e, site.title || site.url)
                }
                onMouseLeave={handleMouseLeave}
              >
                {site.title || site.url}
              </a>
            </div>
            <div className="site-details">
              <div className="progress-bar">
                <div
                  className="progress"
                  style={{ width: `${site.percentage}%` }}
                />
              </div>
              <span className="duration">{formatDuration(site.duration)}</span>
              <span className="percentage">{site.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
      {tooltip && (
        <div
          className="popper-tooltip"
          ref={tooltipRef}
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
          }}
        >
          {tooltip.content}
        </div>
      )}
      {showCategoryPrompt && (
        <div className="category-prompt-modal">
          <div className="category-prompt-content">
            <h4>Assign Category</h4>
            <p>
              Assign a category for <b>{showCategoryPrompt.domain}</b>:
            </p>
            <input
              type="text"
              placeholder="Enter category"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value) {
                  showCategoryPrompt.onAssign(e.currentTarget.value);
                }
              }}
            />
            <button onClick={() => setShowCategoryPrompt(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyReport;
