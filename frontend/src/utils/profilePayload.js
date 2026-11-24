// Students can update their own profile details but not verified identity fields.
export function profileUpdatePayload(form, role) {
  if (role === "student") {
    const { name, company, ...editableDetails } = form;
    return editableDetails;
  }
  return { ...form };
}
