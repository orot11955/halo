export type PortProtocol = 'tcp' | 'udp';
export type PortVisibility = 'public' | 'private' | 'localhost';

export interface NodePort {
  port: number;
  protocol: PortProtocol;
  bind_address: string;
  process: string;
  pid?: number;
  linked_service?: string;
  visibility: PortVisibility;
  registered: boolean;
}
