// src/pages/Notification/NotificationsPage.tsx
// ✅ DESIGN B - TIMELINE + GROUPED VIEW - PRODUCTION READY

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationLabel,
  getNotificationColor,
  getNotificationIcon,
  getNotificationLink,
  type NotificationResponse,
} from "../../services/notificationservice";

interface GroupedNotifications {
  today: NotificationResponse[];
  yesterday: NotificationResponse[];
  thisWeek: NotificationResponse[];
  older: NotificationResponse[];
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const userEmail = localStorage.getItem("userEmail") || "admin@standphill.com";

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/notifications/${userEmail}`);
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading notifications:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userEmail);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return "now";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const groupNotificationsByDate = (
    notifs: NotificationResponse[]
  ): GroupedNotifications => {
    const groups: GroupedNotifications = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    notifs.forEach((notif) => {
      if (!notif.createdAt) {
        groups.today.push(notif);
        return;
      }

      const notifDate = new Date(notif.createdAt);
      const notifDateOnly = new Date(
        notifDate.getFullYear(),
        notifDate.getMonth(),
        notifDate.getDate()
      );

      if (notifDateOnly.getTime() === today.getTime()) {
        groups.today.push(notif);
      } else if (notifDateOnly.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notif);
      } else if (notifDateOnly.getTime() > weekAgo.getTime()) {
        groups.thisWeek.push(notif);
      } else {
        groups.older.push(notif);
      }
    });

    return groups;
  };

  // ✅ FIX: getNotificationLabel use kiya (safe fallback) instead of direct map indexing
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "unread" && n.read) return false;
      if (filter === "read" && !n.read) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          n.message.toLowerCase().includes(query) ||
          getNotificationLabel(n.type).toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [notifications, filter, searchQuery]);

  const grouped = groupNotificationsByDate(filtered);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasResults =
    grouped.today.length +
      grouped.yesterday.length +
      grouped.thisWeek.length +
      grouped.older.length >
    0;

  const NotificationItem = ({
    notif,
    isLast,
  }: {
    notif: NotificationResponse;
    isLast: boolean;
  }) => {
    // ✅ FIX: safe getters — kabhi undefined nahi aayenge, crash nahi hoga
    const colors = getNotificationColor(notif.type);
    const label = getNotificationLabel(notif.type);
    const icon = getNotificationIcon(notif.type);
    const link = getNotificationLink(notif.type, notif.referenceType, notif.referenceId);

    const handleClick = () => {
      if (!notif.read) handleMarkRead(notif.id);
      if (link) navigate(link);
    };

    return (
      <div
        onClick={handleClick}
        style={{
          padding: "14px 16px",
          borderBottom: !isLast ? "0.5px solid #f3f4f6" : "none",
          background: notif.read ? "#fff" : "#eff6ff",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
          cursor: link ? "pointer" : "default",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!notif.read) {
            e.currentTarget.style.background = "#dbeafe";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = notif.read ? "#fff" : "#eff6ff";
        }}
      >
        <div
          style={{
            fontSize: "22px",
            minWidth: "28px",
            textAlign: "center",
            marginTop: "2px",
          }}
        >
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "4px",
                background: colors.bg,
                color: colors.color,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
            <span style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap" }}>
              {formatTime(notif.createdAt)}
            </span>
          </div>

          <div
            style={{
              fontSize: "13px",
              color: "#111827",
              fontWeight: notif.read ? 400 : 500,
              lineHeight: "1.4",
              marginBottom: "4px",
              wordBreak: "break-word",
            }}
          >
            {notif.message}
          </div>

          {!notif.read && (
            <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: 500 }}>
              Click to mark as read
            </div>
          )}
        </div>

        {!notif.read && (
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#2563eb",
              marginTop: "6px",
              flexShrink: 0,
              boxShadow: "0 0 6px rgba(37, 99, 235, 0.4)",
            }}
          />
        )}
      </div>
    );
  };

  const GroupSection = ({
    title,
    notifs,
  }: {
    title: string;
    notifs: NotificationResponse[];
  }) => {
    if (notifs.length === 0) return null;

    return (
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#6b7280",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            padding: "0 4px 10px 4px",
            marginBottom: "8px",
          }}
        >
          {title}
        </div>

        <div
          style={{
            background: "#fff",
            border: "0.5px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {notifs.map((notif, index) => (
            <NotificationItem
              key={notif.id}
              notif={notif}
              isLast={index === notifs.length - 1}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", paddingBottom: "40px" }}>
      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .notifications-header {
          animation: slide-in 0.3s ease-out;
        }

        .notification-group {
          animation: slide-in 0.3s ease-out;
        }

        .search-input::placeholder {
          color: var(--text-secondary, #6b7280);
        }

        .search-input:focus {
          outline: none;
          background: #fff;
        }
      `}</style>

      <div
        className="notifications-header"
        style={{
          background: "#fff",
          borderBottom: "0.5px solid #e5e7eb",
          padding: "20px 32px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "none",
                border: "0.5px solid #e5e7eb",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: "14px",
                color: "#374151",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              ← Back
            </button>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                🔔 Notifications
              </h1>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "13px",
                  color: "#6b7280",
                }}
              >
                {unreadCount} unread · {notifications.length} total
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                padding: "8px 16px",
                background: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "13px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1d4ed8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#2563eb";
              }}
            >
              ✓ Mark All Read
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "12px",
            maxWidth: "900px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#f9fafb",
              border: "0.5px solid #e5e7eb",
              borderRadius: "8px",
              padding: "8px 12px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.borderColor = "#d1d5db";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f9fafb";
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ color: "#9ca3af", flexShrink: 0 }}
            >
              <circle cx="7" cy="7" r="5.5" />
              <path d="M11 11l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                fontSize: "13px",
                color: "#111827",
                fontWeight: 400,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            {(["all", "unread", "read"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "0.5px solid",
                  borderColor: filter === tab ? "#2563eb" : "#e5e7eb",
                  background: filter === tab ? "#2563eb" : "#fff",
                  color: filter === tab ? "#fff" : "#374151",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: "12px",
                  textTransform: "capitalize",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (filter !== tab) {
                    e.currentTarget.style.background = "#f3f4f6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (filter !== tab) {
                    e.currentTarget.style.background = "#fff";
                  }
                }}
              >
                {tab === "all" && "All"}
                {tab === "unread" && "Unread"}
                {tab === "read" && "Read"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "900px", margin: "0 auto" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#9ca3af",
              background: "#fff",
              borderRadius: "12px",
              border: "0.5px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
            <div style={{ fontWeight: 500 }}>Loading notifications...</div>
          </div>
        ) : !hasResults ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "#9ca3af",
              background: "#fff",
              borderRadius: "12px",
              border: "0.5px solid #e5e7eb",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🔔</div>
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: "4px", fontSize: "15px" }}>
              No notifications
            </div>
            <div style={{ fontSize: "13px" }}>
              {searchQuery
                ? "No notifications match your search"
                : filter !== "all"
                  ? `No ${filter} notifications`
                  : "You're all caught up!"}
            </div>
          </div>
        ) : (
          <div>
            <GroupSection title="TODAY" notifs={grouped.today} />
            <GroupSection title="YESTERDAY" notifs={grouped.yesterday} />
            <GroupSection title="THIS WEEK" notifs={grouped.thisWeek} />
            <GroupSection title="OLDER" notifs={grouped.older} />
          </div>
        )}
      </div>
    </div>
  );
}