import { useId, useState } from "react";
import { SKILL_LEVELS } from "../preferences/model";
import {
  HOBBIES,
  MAX_HOBBIES,
  searchHobbies
} from "../preferences/hobbyCatalogue";
import type {
  HobbySelection,
  SkillLevel
} from "../preferences/model";
import "./InterestSkillPicker.css";

interface Props {
  value: HobbySelection;
  onChange: (next: HobbySelection) => void;
  disabled?: boolean;
}

const PAGE_SIZE = 20;

export default function InterestSkillPicker({
  value,
  onChange,
  disabled = false
}: Props) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const selected = HOBBIES.filter(({ id }) =>
    Object.hasOwn(value, id)
  );
  const matches = searchHobbies(query);
  const atLimit = selected.length >= MAX_HOBBIES;

  function removeHobby(hobbyId: string) {
    const next = { ...value };
    delete next[hobbyId];
    onChange(next);
  }

  return (
    <fieldset disabled={disabled} className="hobby-picker">
      <legend>Select your interests</legend>

      <section aria-labelledby={`${id}-selected`}>
        <h2 id={`${id}-selected`}>Your interests</h2>
        <p id={`${id}-limit`} role="status">
          {selected.length} of {MAX_HOBBIES} selected.
          {atLimit
            ? " Remove a hobby to choose another."
            : " Choose up to three and set your level for each."}
        </p>
        {selected.length === 0 ? (
          <p>Search below to add your first hobby.</p>
        ) : (
          <ul className="hobby-selected-list">
            {selected.map(({ id: hobbyId, label }) => (
              <li key={hobbyId} className="hobby-selected">
                <div className="hobby-selected-heading">
                  <strong>{label}</strong>
                  <button
                    className="hobby-picker-button"
                    type="button"
                    aria-label={`Remove ${label}`}
                    onClick={() => removeHobby(hobbyId)}>
                    Remove
                  </button>
                </div>
                <label>
                  Your level in {label}
                  <select
                    value={value[hobbyId]}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        [hobbyId]: event.target
                          .value as SkillLevel
                      })
                    }>
                    {SKILL_LEVELS.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="hobby-search">
        <label htmlFor={`${id}-search`}>Find a hobby</label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          placeholder="Try photography, camera, or bread"
          autoComplete="off"
          aria-describedby={`${id}-hint ${id}-limit`}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          onKeyDown={(event) => {
            // Searching must not submit the onboarding form.
            if (event.key === "Enter") event.preventDefault();
          }}
        />
        <p id={`${id}-hint`}>
          Search {HOBBIES.length} hobbies by name or keyword.
        </p>
      </div>

      <p role="status" aria-atomic="true">
        {matches.length === 0
          ? "No hobbies found. Try another name or keyword."
          : `${matches.length} ${matches.length === 1 ? "hobby" : "hobbies"} found. Showing ${Math.min(visibleCount, matches.length)}.`}
      </p>

      {matches.length > 0 && (
        <ul
          className="hobby-results"
          aria-label="Hobby search results">
          {matches
            .slice(0, visibleCount)
            .map(({ id: hobbyId, label }) => {
              const isSelected = Object.hasOwn(value, hobbyId);
              return (
                <li key={hobbyId} className="hobby-result">
                  <span>{label}</span>
                  <button
                    className="hobby-picker-button"
                    type="button"
                    disabled={isSelected || atLimit}
                    aria-label={
                      isSelected
                        ? `${label} added`
                        : `Add ${label}`
                    }
                    onClick={() => {
                      if (!atLimit && !isSelected) {
                        onChange({
                          ...value,
                          [hobbyId]: SKILL_LEVELS[0]
                        });
                      }
                    }}>
                    {isSelected ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {matches.length > visibleCount && (
        <button
          className="hobby-picker-button hobby-show-more"
          type="button"
          onClick={() =>
            setVisibleCount((count) => count + PAGE_SIZE)
          }>
          Show more hobbies
        </button>
      )}
    </fieldset>
  );
}
