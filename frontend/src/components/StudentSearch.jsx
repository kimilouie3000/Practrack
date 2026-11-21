import { useState } from "react";

export default function StudentSearch({ students = [] }) {
  const [query, setQuery] = useState("");
  const filtered = students.filter((student) =>
    `${student.name} ${student.studentNo}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section>
      <label htmlFor="student-search">Search students</label>
      <input id="student-search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <ul>
        {filtered.map((student) => <li key={student.studentNo}>{student.name} ({student.studentNo})</li>)}
      </ul>
      {filtered.length === 0 && <p role="status">No matching students found.</p>}
    </section>
  );
}
