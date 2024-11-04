"use client";

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Upload, X } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const supabase = createClientComponentClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(
      file => file.type === 'application/pdf'
    );
    setFiles(prev => [...prev, ...pdfFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    setUploading(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${user.id}/${Date.now()}-${file.name}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Process the document (you'll need to implement this endpoint)
        const response = await fetch('/api/process-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName,
            userId: user.id,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to process document');
        }

        setProgress(((i + 1) / files.length) * 100);
      }

      toast({
        title: "Success",
        description: "Documents uploaded and processed successfully",
      });

      setFiles([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Documents</h1>
        <p className="text-muted-foreground">
          Upload your PDF documents to chat with them. Maximum file size is 10MB.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center ${
          isDragActive ? 'border-primary' : 'border-muted-foreground/25'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-4">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">
              {isDragActive
                ? "Drop your PDFs here"
                : "Drag & drop PDFs here, or click to select"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Only PDF files are supported
            </p>
          </div>
          <Button variant="secondary" disabled={uploading}>
            Select Files
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Selected Files</h2>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-sm text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {uploading && (
            <div className="mt-4">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Uploading and processing documents... {Math.round(progress)}%
              </p>
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={uploadFiles}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? "Processing..." : "Upload and Process Files"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}