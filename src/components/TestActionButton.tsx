"use client";

import { useState } from "react";
import { testAction } from "@/app/test-action";
import { Button } from "@/components/ui/button";

export function TestActionButton() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await testAction("Test User");
      setResult(res.message);
    } catch (error) {
      setResult(`Error: ${error}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-2">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Testing..." : "Test Server Action"}
      </Button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
