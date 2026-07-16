import NotificationBell from "../pages/Notification/Notoficationbell";

interface HeaderProps {
  title?: string;
  userEmail?: string;
}

export default function Header({ title = "Dashboard", userEmail = "admin@standphill.com" }: HeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 32px",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>{title}</h1>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        {/* Search */}
        <input
          placeholder="Search..."
          style={{
            padding: "8px 16px",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        />

        {/* Notification Bell */}
        <NotificationBell userEmail={userEmail} />

        {/* Settings */}
        <button style={{ fontSize: "20px", background: "none", border: "none", cursor: "pointer" }}>
          ⚙️
        </button>
      </div>
    </div>
  );
}