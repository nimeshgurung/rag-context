-- Update stored procedure to use 'content' column instead of 'original_text'
-- This is necessary after renaming original_text to content in 20250806211507_simplify_embeddings_structure.sql

DROP FUNCTION IF EXISTS search_library_documentation(text,text,vector,double precision,double precision,integer);

CREATE FUNCTION search_library_documentation(
    p_library_id TEXT,
    p_search_term TEXT,
    p_embedding VECTOR(1536),
    p_vector_weight DOUBLE PRECISION DEFAULT 0.7,
    p_keyword_weight DOUBLE PRECISION DEFAULT 0.3,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    vector_id TEXT,
    content TEXT,  -- Keep return name for backward compatibility
    content_type TEXT,
    metadata JSONB,
    similarity_score DOUBLE PRECISION,
    keyword_score DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            e.vector_id,
            e.content,  -- Updated from original_text
            e.content_type,
            e.metadata,
            (1 - (e.embedding <=> p_embedding))::DOUBLE PRECISION AS vector_similarity
        FROM embeddings e
        WHERE e.library_id = p_library_id
            AND e.embedding IS NOT NULL
    ),
    keyword_search AS (
        SELECT
            e.vector_id,
            e.content,  -- Updated from original_text
            e.content_type,
            e.metadata,
            ts_rank_cd(
                to_tsvector('english', e.content),  -- Updated from original_text
                plainto_tsquery('english', p_search_term)
            )::DOUBLE PRECISION AS keyword_rank
        FROM embeddings e
        WHERE e.library_id = p_library_id
            AND to_tsvector('english', e.content) @@ plainto_tsquery('english', p_search_term)  -- Updated
    ),
    combined_results AS (
        SELECT
            COALESCE(v.vector_id, k.vector_id) AS result_vector_id,
            COALESCE(v.content, k.content) AS result_content,  -- Alias for compatibility
            COALESCE(v.content_type, k.content_type) AS result_content_type,
            COALESCE(v.metadata, k.metadata) AS result_metadata,
            COALESCE(v.vector_similarity, 0) AS result_similarity_score,
            COALESCE(k.keyword_rank, 0) AS result_keyword_score,
            (
                COALESCE(v.vector_similarity, 0) * p_vector_weight +
                COALESCE(k.keyword_rank, 0) * p_keyword_weight
            ) AS result_hybrid_score
        FROM vector_search v
        FULL OUTER JOIN keyword_search k ON v.vector_id = k.vector_id
    )
    SELECT
        result_vector_id,
        result_content,  -- Returns content as original_text for backward compatibility
        result_content_type,
        result_metadata,
        result_similarity_score,
        result_keyword_score,
        result_hybrid_score
    FROM combined_results
    WHERE result_hybrid_score > 0
    ORDER BY result_hybrid_score DESC
    LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_library_documentation IS 'Searches documentation within a specific library using hybrid approach - updated to use content column';