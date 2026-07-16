// src/pages/Notification/Notoficationbell.tsx
// ✅ FINAL SAFE VERSION - Works with or without ToastProvider
// No require() - Pure TypeScript/React

import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import {
  markNotificationRead,
  markAllNotificationsRead,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_TYPE_ICONS,
  type NotificationResponse,
} from "../../services/notificationservice";
import { useToastNotification } from "../../hooks/useToastNotification";

interface NotificationBellProps {
  userEmail: string;
}

// Backend ke NotificationType ko toast ke colour-variant se map karna
const TOAST_VARIANT: Record<string, "success" | "info" | "warning" | "error"> = {
  TASK_COMPLETED: "success",
  DEAL_CREATED: "success",
  PROJECT_CREATED: "success",
  NEW_LEAD: "success",
  CERTIFICATION_CREATED: "success",
  VISIT_ASSIGNED: "info",
  VISIT_TOMORROW: "info",
  VISIT_TODAY: "info",
  TASK_ASSIGNED: "info",
  CERTIFICATION_RENEWAL: "info",
  CERTIFICATION_RENEWAL_REMINDER: "warning",
  DEAL_STAGE_CHANGED: "info",
  TASK_OVERDUE: "warning",
  PAYMENT_OVERDUE: "warning",
  VISIT_EXPIRED: "warning",
  TASK_EXPIRED: "warning",
};

export default function NotificationBell({ userEmail }: NotificationBellProps) {
  const navigate = useNavigate();
  const toast = useToastNotification();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // "Already dikha diya" notifications ki list — re-render pe reset nahi hoti
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstPoll = useRef(true);

  // Poll for updates every 10 seconds
  const pollNotifications = useCallback(async () => {
    if (!userEmail) return; // not known yet (e.g. brief moment right after mount) — skip
    try {
      const response = await api.get(`/notifications/${userEmail}`);
      const list: NotificationResponse[] = Array.isArray(response.data) ? response.data : [];

      setUnreadCount(list.filter((n) => !n.read).length);

      if (isFirstPoll.current) {
        // Page load hote hi purani notifications ke liye toast mat dikhao,
        // bas unko "seen" maan lo
        list.forEach((n) => seenIds.current.add(n.id));
        isFirstPoll.current = false;
        return;
      }

      // Jo IDs pehle nahi dekhi thi — wahi asli "naye" notifications hain
      const freshOnes = list.filter((n) => !seenIds.current.has(n.id));

      freshOnes.forEach((n) => {
        seenIds.current.add(n.id);
        const variant = TOAST_VARIANT[n.type] ?? "info";
        const title =
          NOTIFICATION_TYPE_LABELS[n.type as keyof typeof NOTIFICATION_TYPE_LABELS] ??
          "Notification";
        toast[variant](title, n.message);
      });
    } catch (err) {
      console.error("Error polling notifications:", err);
    }
  }, [userEmail, toast]);

  // Load notifications when dropdown opens — uses the SAME per-user
  // endpoint as pollNotifications() above. Previously this called
  // /notifications/all, which is @PreAuthorize("hasRole('ADMIN')") on the
  // backend — so for every non-admin role (Marketing, Engineer, Ops,
  // Finance) this silently 403'd and the dropdown always showed empty,
  // even though the bell badge (which does use the per-user endpoint)
  // showed the correct unread count. /notifications/{email} already
  // returns the full admin merged view when the caller IS an admin, so
  // there's no functionality lost by using it for everyone.
  const loadNotifications = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const response = await api.get(`/notifications/${userEmail}`);
      setNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Error loading notifications:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  // Poll on mount
  useEffect(() => {
    pollNotifications();
    const interval = setInterval(pollNotifications, 1000);
    return () => clearInterval(interval);
  }, [pollNotifications]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    } 
  }, [isOpen, loadNotifications]);

  const handleNotificationClick = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      pollNotifications();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(userEmail);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking all as read:", err);
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

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        @keyframes bell-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        .notification-bell-animated {
          animation: bell-pulse 2s infinite;
        }

        .notification-badge {
          animation: badge-pop 0.3s ease-out;
        }

        @keyframes badge-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .notification-item-unread {
          background: #eff6ff;
          transition: all 0.2s ease;
        }

        .notification-item-unread:hover {
          background: #dbeafe;
        }

        .notification-item-read {
          background: #fff;
          opacity: 0.75;
          transition: all 0.2s ease;
        }

        .notification-item-read:hover {
          background: #f3f4f6;
          opacity: 1;
        }

        .dropdown-enter {
          animation: dropdown-slide 0.2s ease-out;
        }

        @keyframes dropdown-slide {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .button-primary-subtle {
          transition: all 0.2s ease;
        }

        .button-primary-subtle:hover {
          background: #0d47a1 !important;
          color: #fff !important;
        }

        .button-secondary-subtle:hover {
          background: #e5e7eb !important;
        }

        .notification-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .notification-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .notification-scroll::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }

        .notification-scroll::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      {/* Bell Icon Button - ANIMATED */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "8px",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className={unreadCount > 0 ? "notification-bell-animated" : ""}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#2563eb";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#6b7280";
        }}
        title="Notifications"
      >
        {/* Bell Icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "inherit" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge - ANIMATED */}
        {unreadCount > 0 && (
          <span
            className="notification-badge"
            style={{
              position: "absolute",
              top: "-6px",
              right: "-6px",
              background: "linear-gradient(135deg, #dc2626, #991b1b)",
              color: "#fff",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: "700",
              border: "2.5px solid #fff",
              boxShadow: "0 0 12px rgba(220, 38, 38, 0.4)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Overlay to close */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 30,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Container */}
          <div
            className="dropdown-enter"
            style={{
              position: "fixed",
              bottom: "auto",
              right: "32px",
              top: "72px",
              background: "#fff",
              border: "0.5px solid #e5e7eb",
              borderRadius: "12px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
              width: "420px",
              maxHeight: "calc(100vh - 140px)",
              minHeight: "280px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              zIndex: 50,
              maxWidth: "calc(100vw - 32px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "0.5px solid #e5e7eb",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                background: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)",
                flexShrink: 0,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  Notifications
                </h3>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  {unreadCount} unread · {notifications.length} total
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                  color: "#9ca3af",
                  padding: "0",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#6b7280")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
              >
                ✕
              </button>
            </div>

            {/* Notification List - SCROLLABLE */}
            <div
              className="notification-scroll"
              style={{
                overflowY: "auto",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {loading ? (
                <div
                  style={{
                    padding: "32px 20px",
                    textAlign: "center",
                    color: "#6b7280",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "#2563eb",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <span>Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    padding: "48px 20px",
                    textAlign: "center",
                    color: "#9ca3af",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ fontSize: "32px" }}>🛏️</div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>All caught up!</div>
                  <div style={{ fontSize: "12px" }}>No new notifications</div>
                </div>
              ) : (
                notifications.map((notif, index) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id)}
                    className={notif.read ? "notification-item-read" : "notification-item-unread"}
                    style={{
                      padding: "14px 16px",
                      borderBottom: index < notifications.length - 1 ? "0.5px solid #f3f4f6" : "none",
                      cursor: "pointer",
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        fontSize: "20px",
                        minWidth: "24px",
                        textAlign: "center",
                        marginTop: "2px",
                      }}
                    >
                      {NOTIFICATION_TYPE_ICONS[notif.type as keyof typeof NOTIFICATION_TYPE_ICONS]}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Type Badge */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "6px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: "4px",
                            background: NOTIFICATION_TYPE_COLORS[notif.type as keyof typeof NOTIFICATION_TYPE_COLORS]?.bg,
                            color: NOTIFICATION_TYPE_COLORS[notif.type as keyof typeof NOTIFICATION_TYPE_COLORS]?.color,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {NOTIFICATION_TYPE_LABELS[notif.type as keyof typeof NOTIFICATION_TYPE_LABELS]}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#9ca3af",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>

                      {/* Message */}
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#111827",
                          fontWeight: notif.read ? 400 : 500,
                          lineHeight: "1.4",
                          marginBottom: "2px",
                          wordBreak: "break-word",
                        }}
                      >
                        {notif.message}
                      </div>
                    </div>

                    {/* Unread Dot */}
                    {!notif.read && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#2563eb",
                          flexShrink: 0,
                          marginTop: "6px",
                          boxShadow: "0 0 6px rgba(37, 99, 235, 0.4)",
                        }}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "0.5px solid #e5e7eb",
                  display: "flex",
                  gap: "8px",
                  background: "#f9fafb",
                  flexShrink: 0,
                }}
              >
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="button-primary-subtle"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Mark all as read
                  </button>
                )}
                <button
                  onClick={() => {
                    navigate("/notifications");
                    setIsOpen(false);
                  }}
                  className="button-secondary-subtle"
                  style={{
                    flex: unreadCount > 0 ? 1 : 2,
                    padding: "8px 12px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  View all
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}