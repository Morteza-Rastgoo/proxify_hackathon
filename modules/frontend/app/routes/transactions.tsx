import { useEffect, useState } from "react";
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

interface Transaction {
  id: string;
  vernr: string;
  account_number: number;
  posting_date: string;
  registration_date: string;
  account_name: string;
  ks?: string;
  project_number?: string;
  verification_text?: string;
  transaction_info?: string;
  debit: number;
  credit: number;
  supplier_name?: string;
}

interface PaginatedResponse {
  items: Transaction[];
  total: number;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "posting_date",
    direction: "desc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [refining, setRefining] = useState(false);
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
      const response = await fetch(`${apiBaseUrl}/transactions/?${params}`);
      const data: PaginatedResponse = await response.json();
      setTransactions(data.items || []); 
      setTotalItems(data.total || 0);
    } catch (error) {
      console.error("Error fetching transactions:", error);
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

  const handleRefineSuppliers = async () => {
    setRefining(true);
    try {
      const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:3030";
      const response = await fetch(`${apiBaseUrl}/costs/refine-transactions-add-supplier`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.detail || "Failed to refine transactions"}`);
        return;
      }

      const data = await response.json();
      alert(data.message);
      fetchData(); // Refresh the list to show new suppliers
    } catch (error) {
      console.error("Error refining transactions:", error);
      alert("An error occurred while calling the AI refinement endpoint.");
    } finally {
      setRefining(false);
    }
  };

  // Server-side total pages
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <Button onClick={handleRefineSuppliers} disabled={refining}>
          {refining ? "Refining..." : "Refine Suppliers (AI)"}
        </Button>
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
               <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("supplier_name")}
                  className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold"
                >
                  Supplier 
                  {sortConfig.key === "supplier_name" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("debit")}
                  className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold ml-auto"
                >
                  Debit 
                  {sortConfig.key === "debit" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </Button>
              </TableHead>
               <TableHead className="text-right">
                <Button
                  variant="ghost"
                  onClick={() => handleSort("credit")}
                  className="flex items-center gap-1 p-0 hover:bg-transparent font-semibold ml-auto"
                >
                  Credit 
                  {sortConfig.key === "credit" && (sortConfig.direction === "asc" ? "↑" : "↓")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction, index) => (
              <TableRow key={transaction.id || index}>
                <TableCell>{transaction.posting_date}</TableCell>
                <TableCell>
                  {transaction.account_number} - {transaction.account_name}
                </TableCell>
                <TableCell>
                  <div>{transaction.verification_text}</div>
                  <div className="text-sm text-gray-500">{transaction.transaction_info}</div>
                </TableCell>
                <TableCell>
                  {transaction.supplier_name || "-"}
                </TableCell>
                <TableCell className="text-right">
                  {transaction.debit.toLocaleString("sv-SE", {
                    style: "currency",
                    currency: "SEK",
                  })}
                </TableCell>
                 <TableCell className="text-right">
                  {transaction.credit.toLocaleString("sv-SE", {
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
  );
}
