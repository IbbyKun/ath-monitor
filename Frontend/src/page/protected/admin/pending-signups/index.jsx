import React, { useEffect, useState, useCallback } from "react";
import PendingSignupsTable from "@/components/common/pending-signups/PendingSignupsTable";
import { fetchPendingSignups } from "./service";
import { fetchFilterOptions } from "@/page/protected/admin/employee-details/service";

const PendingSignups = () => {
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    fetchFilterOptions().then(({ roles: r, locations: l }) => {
      setRoles(r);
      setLocations(l);
    });
  }, []);

  const loadSignups = useCallback(async () => {
    setLoading(true);
    try {
      setSignups(await fetchPendingSignups());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSignups(); }, [loadSignups]);

  return (
    <div className="bg-slate-200 w-full p-5 min-h-screen">
      <PendingSignupsTable
        signups={signups}
        loading={loading}
        onRefresh={loadSignups}
        locations={locations}
        roles={roles}
      />
    </div>
  );
};

export default PendingSignups;
