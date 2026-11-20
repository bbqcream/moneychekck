import { spendingPriorities, type SpendingPriority } from "@/types/scenario";
import { priorityLabels } from "./labels";

export function PriorityField({ value }: { value?: SpendingPriority }) {
  return (
    <label className="field">
      우선순위
      <select name="priority" defaultValue={value ?? ""}>
        <option value="">미지정</option>
        {spendingPriorities.map((priority) =>
          <option key={priority} value={priority}>{priorityLabels[priority]}</option>,
        )}
      </select>
    </label>
  );
}
