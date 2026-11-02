// Questions the generated NERM workflow catalog can answer. Keep these in sync
// with knowledge-base/uchicago-nerm/generated-workflows when workflows change.
export type QuestionCategory = {
  name: string;
  questions: string[];
};

export const QUESTION_LIBRARY: QuestionCategory[] = [
  {
    name: "Assignments",
    questions: [
      "How do I add a new assignment for an existing person?",
      "How do I change an assignment's end date?",
      "What is the longest an assignment can last?",
      "What happens if the end date is before the start date?",
      "How do I end an assignment early?",
      "What happens to the person's profile when an assignment is ended?",
      "What risk questions are asked when creating an assignment?",
      "What are the Non-Employee Type options?",
      "Who becomes the sponsor on a new assignment?",
      "Who is notified when assignment details are updated?",
    ],
  },
  {
    name: "People",
    questions: [
      "How do I create a new person in NERM?",
      "What is the difference between New Person and New Person + Assignment?",
      "How does NERM prevent duplicate person profiles?",
      "Can I use a uchicago.edu email as the external email address?",
      "What format do ChicagoID and CNetID need to be in?",
      "How do I update a person's name or phone number?",
      "When is a person marked active or inactive?",
    ],
  },
  {
    name: "Service accounts",
    questions: [
      "How do I create a new service account?",
      "How do I change a service account's end date?",
      "How do I reactivate a service account?",
      "How do I expire a service account?",
      "How do I assign a new owner to a service account?",
    ],
  },
  {
    name: "Test accounts",
    questions: [
      "How do I create a test account?",
      "How do I change a test account's end date?",
      "How do I reactivate a test account?",
      "How do I expire a test account?",
      "How do I transfer ownership of a test account?",
    ],
  },
  {
    name: "Organizations",
    questions: [
      "How do I request a new organization?",
      "What information is needed to request a new organization?",
      "Who is notified when a new organization is created?",
      "How do I update an organization's owner?",
    ],
  },
  {
    name: "Bulk import",
    questions: [
      "How do I bulk import people from a CSV?",
      "Which fields are required for a bulk person import?",
      "What happens if a bulk-imported person already exists?",
      "How do I bulk import assignments?",
    ],
  },
];
