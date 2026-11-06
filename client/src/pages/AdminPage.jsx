import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateUserRole,
  updateUserActiveStatus
} from '../api/admin.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/Spinner.jsx';
import { Pagination } from '../components/Pagination.jsx';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users management state
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetchAdminStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      toast.error('Failed to load platform stats');
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchAdminUsers({
        q: userSearch.trim() || undefined,
        role: roleFilter || undefined,
        page: userPage,
        limit: 10
      });
      if (res.success && res.data) {
        setUsers(res.data.items || []);
        setUserTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch, roleFilter, userPage]);

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [loadStats, loadUsers]);

  const handleRoleChange = async (targetUser, newRole) => {
    try {
      const res = await updateUserRole(targetUser._id, newRole);
      if (res.success) {
        toast.success(`Role updated for ${targetUser.name} to ${newRole}`);
        loadUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update user role');
    }
  };

  const handleActiveToggle = async (targetUser) => {
    try {
      const newActive = !targetUser.isActive;
      const res = await updateUserActiveStatus(targetUser._id, newActive);
      if (res.success) {
        toast.success(`User ${newActive ? 'activated' : 'deactivated'}`);
        loadUsers();
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to toggle active status');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl sm:text-5xl font-black text-[#2B2340] tracking-tight">
          Admin
        </h1>
      </div>

      {/* --- 4 KPI BLOCKS (Matches Screenshot 6) --- */}
      {loadingStats || !stats ? (
        <div className="min-h-[140px] flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {/* USERS */}
          <div className="p-6 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
              USERS
            </div>
            <div className="text-4xl sm:text-5xl font-black text-[#2B2340] mt-2">
              {stats.totalUsers}
            </div>
          </div>

          {/* EVENTS */}
          <div className="p-6 bg-[#B8E0D2] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
              EVENTS
            </div>
            <div className="text-4xl sm:text-5xl font-black text-[#2B2340] mt-2">
              {stats.totalEvents}
            </div>
          </div>

          {/* REGISTRATIONS */}
          <div className="p-6 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
              REGISTRATIONS
            </div>
            <div className="text-4xl sm:text-5xl font-black text-[#2B2340] mt-2">
              {stats.totalConfirmedRegistrations?.toLocaleString() || stats.totalConfirmedRegistrations}
            </div>
          </div>

          {/* ATTENDANCE */}
          <div className="p-6 bg-[#FFB3C7] border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80">
              ATTENDANCE
            </div>
            <div className="text-4xl sm:text-5xl font-black text-[#2B2340] mt-2">
              {stats.overallAttendanceRate}%
            </div>
          </div>
        </div>
      )}

      {/* --- 30-DAY BAR CHART CARD (Matches Screenshot 6) --- */}
      {stats && (
        <div className="p-6 sm:p-8 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340]">
          <div className="font-mono text-xs uppercase tracking-widest font-bold text-[#2B2340]/80 mb-6">
            REGISTRATIONS · LAST 30 DAYS
          </div>

          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.registrationsLast30Days}>
                <XAxis
                  dataKey="date"
                  stroke="#2B2340"
                  fontSize={10}
                  fontFamily="DM Mono"
                  tickFormatter={(str) => str.slice(5)}
                  hide={true}
                />
                <YAxis
                  stroke="#2B2340"
                  fontSize={10}
                  fontFamily="DM Mono"
                  allowDecimals={false}
                  hide={true}
                />
                <Tooltip
                  contentStyle={{
                    background: '#FFFFFF',
                    borderColor: '#2B2340',
                    borderWidth: '2px',
                    borderRadius: '0px',
                    boxShadow: '4px 4px 0px #2B2340',
                    fontFamily: 'DM Mono',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count">
                  {stats.registrationsLast30Days.map((entry, index) => {
                    const isLast = index === stats.registrationsLast30Days.length - 1;
                    return (
                      <Cell
                        key={`bar-${index}`}
                        fill={isLast ? '#FFB3C7' : '#2B2340'}
                        stroke="#2B2340"
                        strokeWidth={1}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* --- USERS TABLE (Matches Screenshot 6) --- */}
      <div className="space-y-4">
        {/* Table Search / Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <input
            type="text"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => {
              setUserSearch(e.target.value);
              setUserPage(1);
            }}
            className="input-base w-full sm:w-72 font-mono text-xs"
          />

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setUserPage(1);
            }}
            className="input-base w-auto font-mono text-xs uppercase"
          >
            <option value="">ALL ROLES</option>
            <option value="attendee">ATTENDEE</option>
            <option value="organizer">ORGANIZER</option>
            <option value="admin">ADMIN</option>
          </select>
        </div>

        {loadingUsers ? (
          <div className="py-12 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] text-center font-mono text-xs text-[#2B2340]">
            NO USERS FOUND
          </div>
        ) : (
          <div className="bg-white border-2 border-[#2B2340] shadow-[5px_5px_0px_#2B2340] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#2B2340]">
                <thead className="bg-white font-mono text-xs font-bold uppercase tracking-wider border-b-2 border-[#2B2340]">
                  <tr>
                    <th className="px-6 py-4">NAME</th>
                    <th className="px-6 py-4">EMAIL</th>
                    <th className="px-6 py-4">ROLE</th>
                    <th className="px-6 py-4">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#2B2340]/15">
                  {users.map((u) => {
                    const isSelf = currentUser?._id === u._id;
                    const isAdmin = u.role === 'admin';

                    return (
                      <tr key={u._id} className="hover:bg-[#FFF4EC]/50 transition-colors">
                        <td className="px-6 py-4 font-bold">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 font-mono text-[10px] bg-[#B8E0D2] border border-[#2B2340] px-1.5 py-0.2">
                              YOU
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 font-mono text-xs text-[#2B2340]/80">
                          {u.email}
                        </td>

                        <td className="px-6 py-4">
                          {isAdmin || isSelf ? (
                            <span className="font-mono text-xs uppercase font-bold text-[#2B2340]/60">
                              {u.role}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u, e.target.value)}
                              className="font-mono text-xs uppercase border-2 border-[#2B2340] bg-white px-2.5 py-1 text-[#2B2340] focus:outline-none"
                            >
                              <option value="attendee">attendee</option>
                              <option value="organizer">organizer</option>
                            </select>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => !isSelf && handleActiveToggle(u)}
                            disabled={isSelf}
                            className={`font-mono uppercase text-xs tracking-wider font-bold border-2 border-[#2B2340] px-3 py-1 transition-all ${
                              u.isActive
                                ? 'bg-[#2B2340] text-white hover:bg-[#2B2340]/90'
                                : 'bg-white text-[#2B2340] hover:bg-[#FFF4EC]'
                            } ${isSelf ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t-2 border-[#2B2340]">
              <Pagination page={userPage} totalPages={userTotalPages} onPageChange={(p) => setUserPage(p)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
