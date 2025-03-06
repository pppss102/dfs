using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace common.FileSystem
{
    class FileNode : IFsNode
    {
        /// <summary>
        /// == 16MB
        /// </summary>
        public static readonly int ChunkByteSize = 16 * 1024 * 1024;

        public FileNode(string path, string? name = null)
        {
            FileInfo info = new(path);
            Size = info.Length;
            Name = name ?? info.Name;

            var chunkCount = Size / ChunkByteSize + (Size % ChunkByteSize == 0 ? 0 : 1);
            if (chunkCount == 0)
            {
                chunkCount++;
            }

            ChunkHashes = new byte[chunkCount][];

            using var file = new FileStream(path, FileMode.Open, FileAccess.Read);

            var chunk = new byte[ChunkByteSize];
            var fileHash = Array.Empty<byte>();

            for (int i = 0; i < chunkCount; i++)
            {
                int actualLength = file.Read(chunk, 0, ChunkByteSize);
                ChunkHashes[i] = SHA3_512.HashData(new ReadOnlySpan<byte>(chunk, 0, actualLength));

                fileHash = SHA3_512.HashData(fileHash.Concat(ChunkHashes[i]).ToArray());
            }

            ParentHashes = [];

            var hash = Array.Empty<byte>();
            hash = SHA3_512.HashData(hash.Concat(Encoding.UTF8.GetBytes(Name)).ToArray());
            hash = SHA3_512.HashData(hash.Concat(BitConverter.GetBytes(Size)).ToArray());
            hash = SHA3_512.HashData(hash.Concat(fileHash).ToArray());

            Hash = Convert.ToHexStringLower(hash);
        }

        public string Name { get; }

        public long Size { get; }

        public byte[][] ChunkHashes { get; }

        public SortedSet<string> ParentHashes { get; }

        public string Hash { get; }
    }
}
