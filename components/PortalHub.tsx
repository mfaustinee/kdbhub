import React from 'react';
import { ShieldCheck, ArrowRight, Building2, FileCheck, CircleCheck, HelpCircle, AlertTriangle } from 'lucide-react';
import { EnabledModules } from '../types';

interface PortalHubProps {
  onSelectPaymentPortal: () => void;
  onSelectClosurePortal: () => void;
  onSelectComplaintPortal: () => void;
  onSelectInquiryPortal: () => void;
  unreadAgreementsCount: number;
  unreadClosuresCount: number;
  enabledModules?: EnabledModules;
}

export const PortalHub: React.FC<PortalHubProps> = ({ 
  onSelectPaymentPortal, 
  onSelectClosurePortal,
  onSelectComplaintPortal,
  onSelectInquiryPortal,
  enabledModules = {
    levyAgreement: true,
    businessClosure: true,
    clientInquiry: true,
    stakeholderComplaint: true,
  }
}) => {
  const showInquiry = enabledModules.clientInquiry !== false;
  const showComplaint = enabledModules.stakeholderComplaint !== false;
  const showPayment = enabledModules.levyAgreement !== false;
  const showClosure = enabledModules.businessClosure !== false;

  const activeCount = [showInquiry, showComplaint, showPayment, showClosure].filter(Boolean).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-2.5">
        <div className="inline-flex p-2 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm mb-1">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Kenya Dairy Board
        </h1>
        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
          Regulatory Compliance & Client Portal
        </p>
        <p className="max-w-2xl mx-auto text-xs text-slate-500 font-medium leading-relaxed">
          Welcome to the Kenya Dairy Board compliance support platform. 
          Select an active regulatory pathway below to execute a structured levy payment agreement, formally submit a business cessation notice, file a stakeholder complaint, or submit a client inquiry.
        </p>
      </div>

      {activeCount === 0 ? (
        <div className="max-w-xl mx-auto bg-amber-50/80 border border-amber-200 rounded-[32px] p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-800">Client Services Currently Offline</h3>
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              All public client modules are currently under scheduled maintenance or administrative review. Please contact KDB support or try again later.
            </p>
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${activeCount === 1 ? 'max-w-2xl mx-auto' : 'md:grid-cols-2'} gap-8 pt-4`}>
          {/* Card 1: Client Inquiry Form */}
          {showInquiry && (
            <div 
              onClick={onSelectInquiryPortal}
              className="group relative cursor-pointer overflow-hidden rounded-[32px] bg-white border border-slate-100 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-sky-300 p-8 flex flex-col justify-between space-y-8"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50/40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
              
              <div className="space-y-6">
                <div className="inline-flex p-4 bg-sky-50 rounded-2xl text-sky-600 border border-sky-100">
                  <HelpCircle className="w-6 h-6" style={{ color: '#0284c7' }} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-sky-700 transition-colors">
                    Client Inquiry Form
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    KDB Information Desk
                  </p>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Submit general or specific inquiries regarding dairy standards, license renewals, imports/exports regulations, or training schedules.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ask Inquiry</span>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Card 2: Stakeholder Complaints Form */}
          {showComplaint && (
            <div 
              onClick={onSelectComplaintPortal}
              className="group relative cursor-pointer overflow-hidden rounded-[32px] bg-white border border-slate-100 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-rose-300 p-8 flex flex-col justify-between space-y-8"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50/40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
              
              <div className="space-y-6">
                <div className="inline-flex p-4 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-rose-700 transition-colors">
                    Stakeholder Complaints Form
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    KDB Feedback & Redress
                  </p>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Formally submit complaints regarding licensing issues, delayed services, pricing disputes, staff conduct, or regulatory enforcement concerns.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">File Complaint</span>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-red-700 group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Levy Payment Agreement */}
          {showPayment && (
            <div 
              onClick={onSelectPaymentPortal}
              className="group relative cursor-pointer overflow-hidden rounded-[32px] bg-white border border-slate-100 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-emerald-300 p-8 flex flex-col justify-between space-y-8"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
              
              <div className="space-y-6">
                <div className="inline-flex p-4 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">
                    Levy Arrears Payment Portal
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    Portals & Agreements (PAP)
                  </p>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Formally propose or formalize structured installment plans to clear outstanding levy arrears. Verify your premise details to begin your schedule.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access PAP</span>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Card 4: Business Closure Notification */}
          {showClosure && (
            <div 
              onClick={onSelectClosurePortal}
              className="group relative cursor-pointer overflow-hidden rounded-[32px] bg-white border border-slate-100 shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-red-300 p-8 flex flex-col justify-between space-y-8"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50/40 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500"></div>
              
              <div className="space-y-6">
                <div className="inline-flex p-4 bg-red-50 rounded-2xl text-red-600 border border-red-100">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight group-hover:text-red-700 transition-colors">
                    Business Closure & Cessation
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                    KDB Regulatory Notices
                  </p>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    Formally notify KDB of business cessation or permanent premise closures. Essential for regulatory compliance and updating license registries.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notify Cessation</span>
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-w-md mx-auto bg-slate-50 rounded-3xl p-6 border flex items-center space-x-4">
        <CircleCheck className="w-8 h-8 text-emerald-500 shrink-0" />
        <div className="text-left">
          <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Certified</span>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            All data transmissions are fully encrypted and securely logged.
          </p>
        </div>
      </div>
    </div>
  );
};
