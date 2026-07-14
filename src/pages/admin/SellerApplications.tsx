import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface SellerApplication {
  id: string;

  user_id: string;

  store_name: string | null;

  owner_full_name: string | null;

  email: string | null;

  phone: string | null;

  status: string;

  submitted_at: string | null;

  created_at: string;
}

export default function SellerApplications() {

  const navigate = useNavigate();

  const { toast } = useToast();

  const [applications, setApplications] =
    useState<SellerApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const loadApplications =
    async () => {

      setLoading(true);

      try {

        const {
          data,
          error,
        } = await supabase

          .from(
            "seller_applications"
          )

          .select(`
            id,
            user_id,
            store_name,
            owner_full_name,
            email,
            phone,
            status,
            submitted_at,
            created_at
          `)

          .neq(
            "status",
            "draft"
          )

          .order(
            "submitted_at",
            {
              ascending: false,
              nullsFirst: false,
            }
          );


        if (error) {

          throw error;

        }


        setApplications(
          data || []
        );

      } catch (
        error: any
      ) {

        toast({

          title:
            "Unable to load applications",

          description:
            error.message ||
            "Please try again.",

          variant:
            "destructive",

        });

      } finally {

        setLoading(false);

      }

    };


  useEffect(() => {

    loadApplications();

  }, []);


  const filteredApplications =
    applications.filter(
      application => {

        const value =
          search
            .trim()
            .toLowerCase();


        if (!value) {

          return true;

        }


        return (

          application
            .store_name
            ?.toLowerCase()
            .includes(value)

          ||

          application
            .owner_full_name
            ?.toLowerCase()
            .includes(value)

          ||

          application
            .email
            ?.toLowerCase()
            .includes(value)

        );

      }
    );


  const getStatusStyle =
    (
      status: string
    ) => {

      switch (status) {

        case "approved":

          return (
            "bg-green-100 " +
            "text-green-800"
          );


        case "rejected":

          return (
            "bg-red-100 " +
            "text-red-800"
          );


        case "under_review":

          return (
            "bg-blue-100 " +
            "text-blue-800"
          );


        case "changes_requested":

          return (
            "bg-amber-100 " +
            "text-amber-800"
          );


        default:

          return (
            "bg-slate-100 " +
            "text-slate-700"
          );

      }

    };


  return (

    <div
      className="
        min-h-screen
        bg-slate-50
        p-6
      "
    >

      <div
        className="
          mx-auto
          max-w-7xl
        "
      >

        <div
          className="
            flex
            flex-wrap
            items-center
            justify-between
            gap-4
          "
        >

          <div>

            <div
              className="
                flex
                items-center
                gap-3
              "
            >

              <Store
                className="
                  h-8
                  w-8
                  text-green-700
                "
              />

              <h1
                className="
                  text-3xl
                  font-bold
                  text-slate-900
                "
              >

                Seller Applications

              </h1>

            </div>

            <p
              className="
                mt-2
                text-slate-600
              "
            >

              Review seller registrations
              and verification status.

            </p>

          </div>


          <Button
            variant="outline"
            onClick={
              loadApplications
            }
          >

            <RefreshCw
              className="
                mr-2
                h-4
                w-4
              "
            />

            Refresh

          </Button>

        </div>


        <div
          className="
            mt-8
            rounded-2xl
            border
            bg-white
            shadow-sm
          "
        >

          <div
            className="
              border-b
              p-5
            "
          >

            <div
              className="
                relative
                max-w-md
              "
            >

              <Search
                className="
                  absolute
                  left-3
                  top-3
                  h-4
                  w-4
                  text-slate-400
                "
              />

              <input

                value={
                  search
                }

                onChange={
                  event =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                }

                placeholder="
                  Search seller applications
                "

                className="
                  w-full
                  rounded-lg
                  border
                  py-2.5
                  pl-10
                  pr-3
                  outline-none
                  focus:border-green-600
                "

              />

            </div>

          </div>


          {loading ? (

            <div
              className="
                flex
                justify-center
                p-16
              "
            >

              <Loader2
                className="
                  h-7
                  w-7
                  animate-spin
                  text-green-700
                "
              />

            </div>

          ) : (

            <div
              className="
                overflow-x-auto
              "
            >

              <table
                className="
                  w-full
                  text-left
                "
              >

                <thead
                  className="
                    bg-slate-50
                  "
                >

                  <tr>

                    <th
                      className="
                        px-5
                        py-4
                      "
                    >
                      Store
                    </th>

                    <th
                      className="
                        px-5
                        py-4
                      "
                    >
                      Applicant
                    </th>

                    <th
                      className="
                        px-5
                        py-4
                      "
                    >
                      Submitted
                    </th>

                    <th
                      className="
                        px-5
                        py-4
                      "
                    >
                      Status
                    </th>

                    <th
                      className="
                        px-5
                        py-4
                      "
                    >
                      Action
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredApplications
                    .map(
                      application => (

                      <tr

                        key={
                          application.id
                        }

                        className="
                          border-t
                        "

                      >

                        <td
                          className="
                            px-5
                            py-4
                            font-medium
                          "
                        >

                          {
                            application
                              .store_name
                            ||
                            "Unnamed store"
                          }

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <p>

                            {
                              application
                                .owner_full_name
                              ||
                              "Unknown"
                            }

                          </p>

                          <p
                            className="
                              text-sm
                              text-slate-500
                            "
                          >

                            {
                              application
                                .email
                            }

                          </p>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          {
                            application
                              .submitted_at

                            ?

                            new Date(
                              application
                                .submitted_at
                            )
                            .toLocaleDateString()

                            :

                            "Not available"
                          }

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <span

                            className={`
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold

                              ${
                                getStatusStyle(
                                  application
                                    .status
                                )
                              }
                            `}

                          >

                            {
                              application
                                .status
                                .replace(
                                  /_/g,
                                  " "
                                )
                            }

                          </span>

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                          "
                        >

                          <Button

                            size="sm"

                            onClick={
                              () =>
                                navigate(
                                  `/admin/seller-applications/${application.id}`
                                )
                            }

                            className="
                              bg-green-700
                              hover:bg-green-800
                            "

                          >

                            <Eye
                              className="
                                mr-2
                                h-4
                                w-4
                              "
                            />

                            Review

                          </Button>

                        </td>

                      </tr>

                    ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>

  );

}