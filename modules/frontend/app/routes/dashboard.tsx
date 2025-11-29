import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Cost {
  vernr: string;
  account_number: number;
  posting_date: string;
  registration_date: string;
  account_name: string;
  ks: string;
  project_number: string;
  verification_text: string;
  transaction_info: string;
  debit: number;
  credit: number;
}

export default function Dashboard() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "posting_date",
    direction: "desc",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:3030";
      const params = new URLSearchParams({
        sort_by: sortConfig.key,
        order: sortConfig.direction,
      });
      const response = await fetch(`${apiBaseUrl}/costs/?${params}`);
      const data = await response.json();
      setCosts(data);
    } catch (error) {
      console.error("Error fetching costs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current: { key: string; direction: "asc" | "desc" }) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Send CSV directly to API backend, bypassing the frontend proxy
      const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:3030";
      const response = await fetch(`${apiBaseUrl}/costs/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("File uploaded and data seeded successfully!");
        setFile(null);
        // Refresh the data to show newly seeded costs
        await fetchData();
      } else {
        const error = await response.text();
        alert(`Upload failed: ${error}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  const filteredCosts = costs.filter((cost: Cost) =>
    cost.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cost.verification_text && cost.verification_text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalDebet = filteredCosts.reduce((sum: number, cost: Cost) => sum + cost.debit, 0);
  const totalKredit = filteredCosts.reduce((sum: number, cost: Cost) => sum + cost.credit, 0);

  // Prepare data for charts
  const costsByMonth = filteredCosts.reduce((acc: Record<string, number>, cost: Cost) => {
    const month = cost.posting_date.substring(0, 7); // YYYY-MM
    acc[month] = (acc[month] || 0) + cost.debit;
    return acc;
  }, {} as Record<string, number>);

  const barChartData = Object.entries(costsByMonth)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const costsByKonto = filteredCosts.reduce((acc: Record<string, number>, cost: Cost) => {
    const key = `${cost.account_number} - ${cost.account_name}`;
    acc[key] = (acc[key] || 0) + cost.debit;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(costsByKonto)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658", "#8dd1e1", "#a4de6c", "#d0ed57"];

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Cost Dashboard</h1>
        <div className="flex items-center gap-2">
          <Input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="w-64"
          />
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
          >
            {uploading ? "Uploading..." : "Seed from CSV"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Debet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalDebet.toLocaleString("sv-SE", {
                style: "currency",
                currency: "SEK",
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Kredit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalKredit.toLocaleString("sv-SE", {
                style: "currency",
                currency: "SEK",
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCosts.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Expenses by Month</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => Number(value).toLocaleString("sv-SE", { style: "currency", currency: "SEK" })} />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardHeader>
            <CardTitle>Top 10 Expenses by Account</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return percent > 0.05 ? (
                      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    ) : null;
                  }}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => Number(value).toLocaleString("sv-SE", { style: "currency", currency: "SEK" })} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Filter by description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("posting_date")}
                    className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold"
                  >
                    Date 
                    {sortConfig.key === "posting_date" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("account_number")}
                    className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold"
                  >
                    Account 
                    {sortConfig.key === "account_number" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("verification_text")}
                    className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold"
                  >
                    Description 
                    {sortConfig.key === "verification_text" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("debit")}
                    className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold ml-auto"
                  >
                    Amount (Debet) 
                    {sortConfig.key === "debit" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCosts.slice(0, 100).map((cost, index) => (
                <TableRow key={`${cost.vernr}-${index}`}>
                  <TableCell>{cost.posting_date}</TableCell>
                  <TableCell>
                    {cost.account_number} - {cost.account_name}
                  </TableCell>
                  <TableCell>
                    <div>{cost.verification_text}</div>
                    <div className="text-sm text-gray-500">{cost.transaction_info}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    {cost.debit.toLocaleString("sv-SE", {
                      style: "currency",
                      currency: "SEK",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-center text-sm text-gray-500">Thinking filtered costs (showing first 100)</div>
      </div>
    </div>
  );
}
