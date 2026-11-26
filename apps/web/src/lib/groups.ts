export const GROUPS: { id: string; label: string; emoji: string }[] = [
  { id: "food_and_drink", label: "Food and drink", emoji: "🍽️" },
  { id: "shopping", label: "Shopping and retail", emoji: "🛍️" },
  { id: "services_and_business", label: "Business services", emoji: "💼" },
  { id: "health_care", label: "Health care", emoji: "🩺" },
  { id: "lifestyle_services", label: "Beauty and lifestyle", emoji: "💇" },
  { id: "travel_and_transportation", label: "Auto and transport", emoji: "🚗" },
  { id: "sports_and_recreation", label: "Sports and fitness", emoji: "🏋️" },
  { id: "lodging", label: "Hotels and lodging", emoji: "🏨" },
  { id: "education", label: "Education", emoji: "🎓" },
  { id: "arts_and_entertainment", label: "Arts and entertainment", emoji: "🎭" },
  { id: "community_and_government", label: "Community and government", emoji: "🏛️" },
  { id: "cultural_and_historic", label: "Culture and heritage", emoji: "🕌" },
];
export const groupLabel = (id: string) => GROUPS.find((g) => g.id === id)?.label ?? id;
