'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Clock, ArrowRight, Tag } from 'lucide-react';
import { blogApi } from '@/lib/api';

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string | null;
  category: string | null;
  tags: string[];
  read_time_mins: number;
  published_at: string;
  author: { id: number; name: string } | null;
}

const CATEGORIES = ['All', 'Freight', 'Dispatch', 'Compliance', 'Platform', 'Carrier Tips', 'Shipper Guide'];

function PostCard({ post }: { post: Post }) {
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <Link href={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-[var(--color-teal)]/30 transition-all">

      {/* Cover image / placeholder */}
      <div className="h-44 bg-gradient-to-br from-[var(--color-slate)] to-[var(--color-teal)] relative overflow-hidden">
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <span className="text-white text-6xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {post.title.charAt(0)}
            </span>
          </div>
        )}
        {post.category && (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[var(--color-slate)]">
            {post.category}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5">
        <h3 className="font-semibold text-[var(--color-slate)] leading-snug group-hover:text-[var(--color-teal)] transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3 flex-1 mb-4">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--color-cream-dark)]">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-faint)]">
            {post.author && <span>{post.author.name}</span>}
            {post.author && <span>·</span>}
            <span>{date}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-faint)]">
            <Clock size={11} />
            <span>{post.read_time_mins} min read</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [category, setCategory] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['blog', category],
    queryFn: () => blogApi.list(category !== 'All' ? { category } : {}).then(r => r.data),
  });

  const posts: Post[] = data?.data ?? [];

  return (
    <div className="bg-[var(--color-cream)]">

      {/* Hero */}
      <div className="bg-[var(--color-slate)] text-white px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-sage-light)] mb-4">Insights</p>
        <h1 className="text-5xl text-white mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Shipmater Blog
        </h1>
        <p className="text-lg text-[var(--color-sage-light)] max-w-xl mx-auto">
          Freight logistics, carrier compliance, platform updates, and industry insights.
        </p>
      </div>

      {/* Category filter */}
      <div className="bg-[var(--color-white)] border-b border-[var(--color-cream-dark)] sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 overflow-x-auto">
          <div className="flex gap-1 py-3 whitespace-nowrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-[var(--color-teal)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-cream)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Posts */}
      <div className="mx-auto max-w-6xl px-6 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--color-cream-dark)] overflow-hidden">
                <div className="h-44 bg-[var(--color-cream-dark)]" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-3/4 rounded bg-[var(--color-cream-dark)]" />
                  <div className="h-4 w-full rounded bg-[var(--color-cream)]" />
                  <div className="h-4 w-2/3 rounded bg-[var(--color-cream)]" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center">
            <Tag size={32} className="mx-auto mb-4 text-[var(--color-text-faint)]" />
            <p className="text-lg font-semibold text-[var(--color-text)]">No posts yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </div>
  );
}
