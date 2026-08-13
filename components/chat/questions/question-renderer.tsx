import type { ConversationQuestion } from "@/lib/conversation-types";
import { BooleanQuestion } from "@/components/chat/questions/boolean-question";
import { NumberQuestion } from "@/components/chat/questions/number-question";
import { SingleSelectQuestion } from "@/components/chat/questions/single-select-question";
import { VehicleCapacitiesQuestion } from "@/components/chat/questions/vehicle-capacities-question";

export function QuestionRenderer({
  question,
}: {
  question: ConversationQuestion;
}) {
  if (question.type === "boolean") {
    return <BooleanQuestion question={question} />;
  }

  if (question.type === "single_select") {
    return <SingleSelectQuestion question={question} />;
  }

  if (question.type === "number") {
    return <NumberQuestion question={question} />;
  }

  if (question.type === "vehicle_capacities") {
    return <VehicleCapacitiesQuestion question={question} />;
  }

  return null;
}
