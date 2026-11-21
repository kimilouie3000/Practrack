export default function EntryList({ entries = [] }) {
  if (entries.length === 0) {
    return <p role="status">No practicum entries yet. Add your first time entry to begin tracking your hours.</p>;
  }

  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.id}>
          <strong>{entry.date}</strong> · {entry.hoursWorked} · {entry.status}
        </li>
      ))}
    </ul>
  );
}
