"use server";

// Minimal test action with NO external imports
export async function testAction(name: string) {
  console.log("Test action called with:", name);
  return { success: true, message: `Hello, ${name}!` };
}
