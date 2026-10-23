import DashboardLayout from "../components/DashboardLayout"
import { useState, type FormEvent } from "react";

function SearchPage() {
  const [notice, setNotice] = useState("");

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("barebones, no search yet.");
  }

  return (
    <DashboardLayout>
      <div className="page-shell">
        <form className="form-card" onSubmit={handleSearch}>
          <label className="field-group">
            <span>Search projects, makers, and hobbies</span>
            <input name="query" type="search" />
          </label>
          <div className="submit-row">
            <button type="submit" className="primary-button">
              Search
            </button>
          </div>
          {notice && (
            <p className="empty-state" role="status">
              {notice}
            </p>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}
export default SearchPage;
