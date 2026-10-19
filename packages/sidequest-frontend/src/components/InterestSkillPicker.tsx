import { HOBBIES, SKILL_LEVELS } from "../preferences/model";

import type {
  HobbySelection,
  SkillLevel
} from "../preferences/model";

interface Props {
  value: HobbySelection;
  onChange: (next: HobbySelection) => void;
  disabled?: boolean;
}

export default function InterestSkillPicker({
  value,
  onChange,
  disabled = false
}: Props) {
  return (
    <fieldset disabled={disabled}>
      <legend>Select your interests</legend>

      {HOBBIES.map(({ id, label }) => {
        const level = value[id];

        return (
          <div key={id} className="hobby-option">
            <label className="hobby-toggle">
              <input
                type="checkbox"
                checked={level !== undefined}
                onChange={(event) => {
                  const next = { ...value };

                  if (event.target.checked) {
                    next[id] = SKILL_LEVELS[0];
                  } else {
                    delete next[id];
                  }

                  onChange(next);
                }}
              />

              {label}
            </label>

            {level !== undefined && (
              <label>
                Your level in {label}

                <select
                  value={level}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      [id]: event.target.value as SkillLevel
                    })
                  }>
                  {SKILL_LEVELS.map((skill) => (
                    <option key={skill} value={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}