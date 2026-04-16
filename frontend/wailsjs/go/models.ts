export namespace collector {
	
	export class DiskInfo {
	    Path: string;
	    Label: string;
	    Percent: number;
	    UsedGB: number;
	    TotalGB: number;
	
	    static createFrom(source: any = {}) {
	        return new DiskInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Path = source["Path"];
	        this.Label = source["Label"];
	        this.Percent = source["Percent"];
	        this.UsedGB = source["UsedGB"];
	        this.TotalGB = source["TotalGB"];
	    }
	}
	export class Metrics {
	    CPUPercent: number;
	    RAMPercent: number;
	    RAMUsedGB: number;
	    RAMTotalGB: number;
	    SwapPercent: number;
	    SwapUsedGB: number;
	    SwapTotalGB: number;
	    HasSwap: boolean;
	    CPUTempCelsius: number;
	    Disks: DiskInfo[];
	    NetUpBytesPerSec: number;
	    NetDownBytesPerSec: number;
	    GPUPercent: number;
	    HasGPU: boolean;
	    BatteryPercent: number;
	    HasBattery: boolean;
	    RawSent: number;
	    RawRecv: number;
	    RawTime: number;
	
	    static createFrom(source: any = {}) {
	        return new Metrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CPUPercent = source["CPUPercent"];
	        this.RAMPercent = source["RAMPercent"];
	        this.RAMUsedGB = source["RAMUsedGB"];
	        this.RAMTotalGB = source["RAMTotalGB"];
	        this.SwapPercent = source["SwapPercent"];
	        this.SwapUsedGB = source["SwapUsedGB"];
	        this.SwapTotalGB = source["SwapTotalGB"];
	        this.HasSwap = source["HasSwap"];
	        this.CPUTempCelsius = source["CPUTempCelsius"];
	        this.Disks = this.convertValues(source["Disks"], DiskInfo);
	        this.NetUpBytesPerSec = source["NetUpBytesPerSec"];
	        this.NetDownBytesPerSec = source["NetDownBytesPerSec"];
	        this.GPUPercent = source["GPUPercent"];
	        this.HasGPU = source["HasGPU"];
	        this.BatteryPercent = source["BatteryPercent"];
	        this.HasBattery = source["HasBattery"];
	        this.RawSent = source["RawSent"];
	        this.RawRecv = source["RawRecv"];
	        this.RawTime = source["RawTime"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace config {
	
	export class Alerts {
	    CooldownSeconds: number;
	    CPUPercent: number;
	    RAMPercent: number;
	    DiskPercent: number;
	    CPUTempCelsius: number;
	    GPUPercent: number;
	    BatteryLow: number;
	
	    static createFrom(source: any = {}) {
	        return new Alerts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CooldownSeconds = source["CooldownSeconds"];
	        this.CPUPercent = source["CPUPercent"];
	        this.RAMPercent = source["RAMPercent"];
	        this.DiskPercent = source["DiskPercent"];
	        this.CPUTempCelsius = source["CPUTempCelsius"];
	        this.GPUPercent = source["GPUPercent"];
	        this.BatteryLow = source["BatteryLow"];
	    }
	}
	export class Visible {
	    CPU: boolean;
	    RAM: boolean;
	    Swap: boolean;
	    Temp: boolean;
	    Disk: boolean;
	    NetUp: boolean;
	    NetDown: boolean;
	    GPU: boolean;
	    Battery: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Visible(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.CPU = source["CPU"];
	        this.RAM = source["RAM"];
	        this.Swap = source["Swap"];
	        this.Temp = source["Temp"];
	        this.Disk = source["Disk"];
	        this.NetUp = source["NetUp"];
	        this.NetDown = source["NetDown"];
	        this.GPU = source["GPU"];
	        this.Battery = source["Battery"];
	    }
	}
	export class Position {
	    X: number;
	    Y: number;
	
	    static createFrom(source: any = {}) {
	        return new Position(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.X = source["X"];
	        this.Y = source["Y"];
	    }
	}
	export class General {
	    IntervalSeconds: number;
	    Opacity: number;
	    AlwaysOnTop: boolean;
	    Position: Position;
	
	    static createFrom(source: any = {}) {
	        return new General(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.IntervalSeconds = source["IntervalSeconds"];
	        this.Opacity = source["Opacity"];
	        this.AlwaysOnTop = source["AlwaysOnTop"];
	        this.Position = this.convertValues(source["Position"], Position);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Config {
	    General: General;
	    Alerts: Alerts;
	    Visible: Visible;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.General = this.convertValues(source["General"], General);
	        this.Alerts = this.convertValues(source["Alerts"], Alerts);
	        this.Visible = this.convertValues(source["Visible"], Visible);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	

}

