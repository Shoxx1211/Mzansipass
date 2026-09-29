export interface LatLng { lat:number; lng:number }
export interface GeometryEvidence { operatorId:string; routeCode:string; routeName:string; routeId:string;
 originDistanceMetres:number; destinationDistanceMetres:number; geographicEvidence:string;
 directionVerified:false; boardingVerified:false;operatingTodayVerified:false;fare:null;etaMinutes:null;selectable:false }
export interface RailEvidence {operatorId:'gautrain';serviceId:string;serviceName:string;originStation:string;destinationStation:string;
 originDistanceMetres:number;destinationDistanceMetres:number; geographicEvidence:string;
 stoppingOrderVerified:false;operatingTodayVerified:false;fare:null;etaMinutes:null;selectable:false}
export interface UnifiedCoverageRaw {radiusMetres:number;shapeMatches:GeometryEvidence[];totalShapeMatches:number;railMatches:RailEvidence[];
 closestByOperator:Record<string,GeometryEvidence>;operatorInventory:Record<string,unknown>;
 passengerRoutingEnabled:false;verifiedPassengerEdges:0}
export function greatCircleMetres(a:LatLng,b:LatLng):number;
export function segmentDistanceMetres(p:LatLng,a:[number,number],b:[number,number]):number;
export function geometryDistanceMetres(point:LatLng,route:{geometry?:{coordinates:number[][][]}}):number;
export function screenUnifiedCoverage(runtime:unknown,origin:LatLng,destination:LatLng,options?:{radiusMetres?:number}):UnifiedCoverageRaw;
