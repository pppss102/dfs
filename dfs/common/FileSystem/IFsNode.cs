using System.Security.Cryptography;

namespace common.FileSystem
{
    public interface IFsNode
    {
        string Name { get; }
        long Size { get; }
        string Hash { get; }
        SortedSet<string> ParentHashes { get; }
    }
}
