import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { ImportCostsModal } from "~/components/import-costs-modal";
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
import { Button } from "~/components/ui/button";
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

interface PaginatedResponse {
  items: Cost[];
  total: number;
}

export default function Dashboard() {
  const [costs, setCosts] = useState<Cost[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refining, setRefining] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
  }, [sortConfig, currentPage]); 

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

  const handleRefineTransactions = async () => {
    setRefining(true);
    try {
      const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:3030";
      const response = await fetch(`${apiBaseUrl}/costs/refine-costs-to-transactions`, {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to refine transactions");
      }
      
      const data = await response.json();
      alert(`Refined transactions: ${data.message}`);
    } catch (error) {
      console.error("Error refining transactions:", error);
      alert("Error refining transactions. Check console for details.");
    } finally {
      setRefining(false);
    }
  };

  // Filter fetched costs (client-side search on current page only)
  const filteredCosts = costs.filter((cost: Cost) =>
    cost.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cost.verification_text && cost.verification_text.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Server-side total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

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
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Cost Dashboard</h1>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/transactions">Transactions</Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefineTransactions}
            disabled={refining}
          >
            {refining ? "Refining..." : "Refine Transactions"}
          </Button>
          <ImportCostsModal onUploadComplete={fetchData} />
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
