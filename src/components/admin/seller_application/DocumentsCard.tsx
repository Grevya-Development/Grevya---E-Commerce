import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

interface Props {
  documents: any[];
}

export default function DocumentsCard({ documents }: Props) {
  const openDocument = async (document: any) => {
    const { data, error } = await supabase.storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60); // URL valid for 60 seconds

    if (error) {
      console.error(error);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  return (
    <div className="rounded-xl bg-white shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-6">
        Uploaded Documents
      </h2>

      {documents.length === 0 ? (
        <p className="text-gray-500">
          No documents uploaded.
        </p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <h3 className="font-semibold capitalize">
                  {doc.document_type.replace(/_/g, " ")}
                </h3>

                <p className="text-sm text-gray-500">
                  {doc.original_file_name}
                </p>

                <p className="text-xs text-gray-400">
                  Uploaded{" "}
                  {new Date(doc.uploaded_at).toLocaleString()}
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => openDocument(doc)}
              >
                View Document
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}