export const formatOrderDate = (value?: string | null, withTime = false) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions = withTime
    ? {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    : {
        month: "short",
        day: "numeric",
        year: "numeric",
      };

  return date.toLocaleString("en-IN", options);
};
