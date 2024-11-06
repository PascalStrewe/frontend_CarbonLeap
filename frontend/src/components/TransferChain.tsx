import React, { useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  Node,
  Position,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

interface Domain {
  id: number;
  name: string;
  companyName: string;
  supplyChainLevel: number;
}

interface TransferNode {
  id: string;
  amount: number;
  status: string;
  sourceIntervention: {
    id: string;
    interventionId: string;
    modality: string;
    remainingAmount: number;
  };
  sourceDomain: Domain;
  targetDomain: Domain;
  childTransfers: TransferNode[];
  parentTransferId?: string;
}

interface InterventionData {
  intervention: {
    id: string;
    interventionId: string;
    emissionsAbated: number;
    modality: string;
  };
  transferTree: TransferNode[];
}

interface TransferChainProps {
  interventionId: string;
}

const TransferChain: React.FC<TransferChainProps> = ({ interventionId }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom node component
  const CustomNode = ({ data }: { data: any }) => (
    <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg border border-gray-200 shadow-lg min-w-[250px]">
      <div className="text-sm font-medium text-gray-700">
        {data.label}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        Amount: {data.amount?.toFixed(2)} tCO2e
      </div>
      {data.status && (
        <div className={`text-xs mt-1 ${
          data.status === 'completed' ? 'text-green-600' : 
          data.status === 'pending' ? 'text-yellow-600' : 'text-red-600'
        }`}>
          Status: {data.status}
        </div>
      )}
      {data.interventionId && (
        <div className="text-xs text-gray-500 mt-1">
          ID: {data.interventionId}
        </div>
      )}
    </div>
  );

  const nodeTypes = {
    custom: CustomNode,
  };

  const buildInitialNode = (intervention: any): Node => ({
    id: 'initial',
    type: 'custom',
    position: { x: 0, y: 0 },
    data: {
      label: `Original Intervention`,
      amount: intervention.emissionsAbated,
      interventionId: intervention.interventionId,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  const processTransferTree = (
    transfers: any[],
    startX: number = 250,
    startY: number = 0,
    level: number = 0
  ): { nodes: Node[], edges: Edge[] } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const spacing = { x: 250, y: 150 };

    transfers.forEach((transfer, index) => {
      // Debug log to see the transfer object structure
      console.log('Processing transfer:', transfer);

      const nodeId = `transfer-${transfer.id}`;
      const y = startY + (index * spacing.y) - ((transfers.length - 1) * spacing.y / 2);

      // Create node
      nodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: startX + (level * spacing.x), y },
        data: {
          label: transfer.targetDomain?.companyName || 'Unknown Company',
          amount: transfer.amount,
          status: transfer.status,
          interventionId: transfer.sourceIntervention?.interventionId || 'Unknown ID'
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      });

      // Create edge
      const sourceId = level === 0 ? 'initial' : 
        transfer.parentTransferId ? `transfer-${transfer.parentTransferId}` : 'initial';

      edges.push({
        id: `edge-${transfer.id}`,
        source: sourceId,
        target: nodeId,
        type: 'smoothstep',
        animated: transfer.status === 'pending',
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: transfer.status === 'completed' ? '#10B981' : 
                 transfer.status === 'pending' ? '#F59E0B' : '#EF4444'
        },
        label: `${transfer.amount?.toFixed(2)} tCO2e`,
        labelStyle: { fill: '#666', fontWeight: 500 },
        labelBgPadding: [8, 4],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#fff', color: '#666', fillOpacity: 0.7 },
      });

      // Process children recursively if they exist
      if (Array.isArray(transfer.childTransfers) && transfer.childTransfers.length > 0) {
        const childResults = processTransferTree(
          transfer.childTransfers,
          startX + spacing.x,
          y,
          level + 1
        );
        nodes.push(...childResults.nodes);
        edges.push(...childResults.edges);
      }
    });

    return { nodes, edges };
  };

  useEffect(() => {
    const fetchTransferChain = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:3001/api/interventions/${interventionId}/transfer-history`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch transfer chain');
        }

        const data = await response.json();
        console.log('Received transfer chain data:', data);
        
        if (!data.intervention) {
          throw new Error('No intervention data received');
        }

        // Create initial node for the original intervention
        const initialNode = buildInitialNode(data.intervention);
        
        // Process transfer tree
        const { nodes: transferNodes, edges: transferEdges } = processTransferTree(
          data.transferTree || []
        );
        
        setNodes([initialNode, ...transferNodes]);
        setEdges(transferEdges);
      } catch (err) {
        console.error('Error fetching transfer chain:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (interventionId) {
      fetchTransferChain();
    }
  }, [interventionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 rounded-lg bg-red-50">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full bg-gray-50 rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default TransferChain;