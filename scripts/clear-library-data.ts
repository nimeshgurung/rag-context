import pool from '../src/lib/db';

async function clearLibraryData(libraryId: string) {
  if (!libraryId) {
    console.error(
      'Error: Please provide a library ID using the --id flag, e.g., --id /your/library-id',
    );
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    console.log(`Starting to delete data for library: ${libraryId}...`);
    await client.query('BEGIN');

    // Delete from embeddings first due to foreign key constraint
    const deleteEmbeddingsResult = await client.query(
      'DELETE FROM embeddings WHERE library_id = $1',
      [libraryId],
    );
    console.log(
      `Deleted ${deleteEmbeddingsResult.rowCount} records from embeddings.`,
    );

    // Then delete from the libraries table
    const deleteLibraryResult = await client.query(
      'DELETE FROM libraries WHERE id = $1',
      [libraryId],
    );

    if (deleteLibraryResult.rowCount === 0) {
      console.log(
        `Library with ID '${libraryId}' not found in the libraries table.`,
      );
    } else {
      console.log(
        `Deleted ${deleteLibraryResult.rowCount} record from the libraries table.`,
      );
    }

    await client.query('COMMIT');
    console.log(`\nSuccessfully deleted all data for library: ${libraryId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('An error occurred while deleting library data:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Simple command-line argument parsing
const args = process.argv.slice(2);
const idIndex = args.indexOf('--id');
let libraryId = '';

if (idIndex !== -1 && args[idIndex + 1]) {
  libraryId = args[idIndex + 1];
}

clearLibraryData(libraryId);
