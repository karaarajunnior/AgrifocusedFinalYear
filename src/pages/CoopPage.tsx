import React, { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";

type Coop = {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  memberCount?: number;
  createdAt: string;
};

export default function CoopPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Coop[]>([]);
  const [myGroups, setMyGroups] = useState<Coop[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState(user?.location || "");
  const [description, setDescription] = useState("");

  const load = async () => {
    try {
      const [all, mine] = await Promise.all([api.get("/coop"), api.get("/coop/mine")]);
      setGroups(all.data?.groups || []);
      setMyGroups(mine.data?.groups || []);
    } catch {
      toast.error("Failed to load cooperatives");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    try {
      await api.post("/coop", { name, location, description });
      toast.success("Cooperative created");
      setName("");
      setDescription("");
      await load();
    } catch {
      toast.error("Failed to create cooperative");
    }
  };

  const join = async (groupId: string) => {
    try {
      await api.post("/coop/join", { groupId });
      toast.success("Joined cooperative");
      await load();
    } catch {
      toast.error("Failed to join");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cooperatives</h1>
          <p className="text-gray-600 mt-1">
            Pool inventory, negotiate better prices, and organize shared transport.
          </p>
        </div>

        {user.role !== "FARMER" ? (
          <div className="bg-white rounded-lg shadow p-4 text-gray-700">
            Cooperative features are currently for farmers.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900">Create a cooperative</h2>
              <div className="mt-3 space-y-3">
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Cooperative name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Location (district/town)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <button
                  onClick={create}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  disabled={!name.trim()}
                >
                  Create
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-900">My cooperatives</h2>
              <div className="mt-3 space-y-2">
                {loading ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : myGroups.length === 0 ? (
                  <div className="text-sm text-gray-600">You haven’t joined any yet.</div>
                ) : (
                  myGroups.map((g) => (
                    <div key={g.id} className="border rounded-lg p-3">
                      <div className="font-medium text-gray-900">{g.name}</div>
                      <div className="text-sm text-gray-600">{g.location || "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mt-6">
          <h2 className="text-lg font-semibold text-gray-900">Discover cooperatives</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium text-gray-900">{g.name}</div>
                    <div className="text-sm text-gray-600">
                      {g.location || "—"} • {g.memberCount ?? 0} members
                    </div>
                  </div>
                  {user.role === "FARMER" ? (
                    <button
                      onClick={() => join(g.id)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >
                      Join
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

