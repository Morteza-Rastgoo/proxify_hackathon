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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";
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
import type { ChangeEvent } from "react";

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

interface PaginatedResponse {
  items: Cost[];
  total: number;
}

export default function Dashboard() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "posting_date",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:3030";
      const params = new URLSearchParams({
        sort_by: sortConfig.key,
        order: sortConfig.direction,
        limit: itemsPerPage.toString(),
        offset: offset.toString(),
      });
      const response = await fetch(`${apiBaseUrl}/costs/?${params}`);
      const data: PaginatedResponse = await response.json();
      setCosts(data.items || []); // Ensure items is array
      setTotalItems(data.total || 0);
    } catch (error) {
      console.error("Error fetching costs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [sortConfig, currentPage]); // Refetch on page change too

  // Reset page when sort changes (optional, but good UX if order changes drastically)
  useEffect(() => {
    // If sort changes, usually valid to stay on page 1
    if (currentPage !== 1) {
        setCurrentPage(1);
    }
    // But careful with circular dependency if fetchData depends on currentPage
    // `fetchData` reads `currentPage`.
    // If we setPage(1), it triggers `fetchData` via `[currentPage]` dependency.
    // But `[sortConfig]` also triggers `fetchData` in previous code.
    // We should separate reset logic.
    // Implemented below in handleSort logic or just let user stay on page?
    // Standard: New sort -> Page 1.
  }, [sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current: { key: string; direction: "asc" | "desc" }) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1); // Reset to page 1 on sort
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= Math.ceil(totalItems / itemsPerPage)) {
      setCurrentPage(page);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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
        setCurrentPage(1);
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

  // Filter fetched costs (client-side search on current page only)
  const filteredCosts = costs.filter((cost: Cost) =>
    cost.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cost.verification_text && cost.verification_text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Server-side total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Use filtered costs for display (which are actually paginated from server, then filtered further by client search)
  // It's confusing to mix server pagination + client filter on just that page, but safest without Full Text Search implementation.
  
  const totalDebet = filteredCosts.reduce((sum: number, cost: Cost) => sum + cost.debit, 0);
  const totalKredit = filteredCosts.reduce((sum: number, cost: Cost) => sum + cost.credit, 0);

  // Prepare data for charts (Limited to current page data due to server-side pagination)
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
            <CardTitle>Total Debet (Page)</CardTitle>
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
            <CardTitle>Total Kredit (Page)</CardTitle>
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
            <CardTitle>Transactions (Page)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCosts.length} / {totalItems} Total</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Expenses by Month (Page)</CardTitle>
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
            <CardTitle>Top 10 Expenses by Account (Page)</CardTitle>
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
            placeholder="Filter page by description..."
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
              {filteredCosts.map((cost, index) => (
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
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} 
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              
              <PaginationItem>
                <PaginationLink href="#" isActive onClick={(e) => e.preventDefault()}>
                  {currentPage}
                </PaginationLink>
              </PaginationItem>

              <PaginationItem>
                <PaginationNext 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                  className={currentPage === totalPages || totalPages === 0 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
