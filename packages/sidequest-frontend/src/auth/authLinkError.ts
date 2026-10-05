export function getAuthLinkError() {
  const hash = new URLSearchParams(
    window.location.hash.slice(1)
  );
  const query = new URLSearchParams(window.location.search);
  if (hash.has("error") || query.has("error")) {
    return "This email link is invalid or expired. Please request a new link.";
  }
  return "";
}
