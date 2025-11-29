import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "React Router + Bun Template" },
    { name: "description", content: "A modern React app template with React Router, Bun, and shadcn/ui" },
  ];
}

export default function Home() {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHello = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/hello");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setMessage(data.message);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch");
        console.error("Error fetching hello:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHello();
  }, []);

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>API Response</CardTitle>
          <CardDescription>Response from the hello endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          )}
          
          {error && (
            <Badge variant="destructive" className="text-sm">
              Error: {error}
            </Badge>
          )}
          
          {!loading && !error && message && (
            <div className="text-lg font-semibold text-center py-4">
              {message}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="max-w-md mx-auto mt-8 flex justify-center">
        <Button asChild>
          <Link to="/dashboard">Go to Cost Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
