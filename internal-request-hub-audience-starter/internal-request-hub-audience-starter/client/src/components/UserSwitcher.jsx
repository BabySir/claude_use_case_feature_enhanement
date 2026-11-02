export default function UserSwitcher({ users, currentUserId, onChange }) {
  return (
    <label className="user-switcher">
      <span>Viewing as</span>
      <select
        aria-label="Current user"
        value={currentUserId ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} · {user.role}
          </option>
        ))}
      </select>
    </label>
  );
}
