import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Progress } from "~/components/ui/progress"; // Assuming you have this component
import { Separator } from "~/components/ui/separator"; // Assuming you have this component

interface ImportCostsModalProps {
  onUploadComplete: () => void;
}

export function ImportCostsModal({ onUploadComplete }: ImportCostsModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState("keep");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10); // Start progress
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("duplicate_strategy", duplicateStrategy);

    try {
      setProgress(30);
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3030";
      
      const response = await fetch(`${apiBaseUrl}/costs/upload`, {
        method: "POST",
        body: formData,
      });
      
      setProgress(90);

      if (response.ok) {
        const data = await response.json();
        setResult({ success: true, message: data.message || "File uploaded successfully!" });
        setFile(null);
        setProgress(100);
        onUploadComplete();
        setTimeout(() => {
            // Check if component is still mounted? No easy way in FC without ref.
            // But checking if result.success is a proxy.
            setOpen(false);
            setProgress(0);
            setResult(null);
            setUploading(false);
        }, 1500);
      } else {
        const errorText = await response.text();
        console.error("Upload failed:", errorText);
        setResult({ success: false, message: `Upload failed: ${errorText}` });
        setUploading(false);
        setProgress(0);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setResult({ success: false, message: "An error occurred during upload." });
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import Costs</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import cost transactions.
          </DialogDescription>
        </DialogHeader>
        
        {!uploading && !result && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="file" className="text-right">
                File
              </Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="col-span-3"
              />
            </div>
            
            <Separator className="my-2" />
            
            <div className="space-y-2">
              <Label className="text-base">Duplicate Handling</Label>
              <RadioGroup 
                value={duplicateStrategy} 
                onValueChange={setDuplicateStrategy}
                defaultValue="keep"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="keep" id="r1" />
                  <Label htmlFor="r1">Keep all (Allow duplicates)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="r2" />
                  <Label htmlFor="r2">Skip existing (by Vernr)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="r3" />
                  <Label htmlFor="r3">Replace existing (by Vernr)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {uploading && (
          <div className="py-6 space-y-4">
             <div className="space-y-2">
                <Label>Uploading and processing...</Label>
                <Progress value={progress} className="w-full" />
             </div>
             <p className="text-sm text-muted-foreground text-center">Please wait while we process your file.</p>
          </div>
        )}
        
        {result && !uploading && (
             <div className={`py-4 text-center ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                 <p className="font-medium">{result.message}</p>
             </div>
        )}

        <DialogFooter>
          {!uploading && (
              <>
                  <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleUpload} disabled={!file}>Import</Button>
              </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
